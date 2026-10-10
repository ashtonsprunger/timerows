/**
 * TimeRows - City Search Engine
 * 
 * Fast fuzzy autocomplete search engine with alias resolution,
 * diacritic normalization, population-weighted scoring, and timezone indexing.
 * Zero React dependencies.
 */

import citiesData from '../data/cities.json';

/**
 * Remove diacritics/accents and normalize to lowercase.
 * e.g. "São Paulo" -> "sao paulo", "Zürich" -> "zurich"
 * 
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Calculate Levenshtein edit distance between two strings.
 * Used for typo tolerance.
 * 
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Pre-indexes cities by ID and timezone for O(1) lookups
 */
const cityMapById = new Map();
const citiesByTz = new Map();

for (const city of citiesData) {
  cityMapById.set(city.id, city);
  const tzList = citiesByTz.get(city.timeZone) || [];
  tzList.push(city);
  citiesByTz.set(city.timeZone, tzList);
}

/**
 * Get city by its unique ID.
 * @param {string} id
 * @returns {Object|null}
 */
export function getCityById(id) {
  return cityMapById.get(id) || null;
}

/**
 * Find all cities in a specific IANA timezone.
 * @param {string} timeZone
 * @returns {Array<Object>}
 */
export function findCitiesByTimezone(timeZone) {
  return citiesByTz.get(timeZone) || [];
}

/**
 * Returns the highest population city for a timezone.
 * Ideal for mapping detected local timezones to friendly city names.
 * 
 * @param {string} timeZone
 * @returns {Object|null}
 */
export function findPrimaryCityForTimezone(timeZone) {
  const matches = findCitiesByTimezone(timeZone);
  if (!matches || matches.length === 0) return null;
  return matches.reduce((highest, current) => {
    return (current.population || 0) > (highest.population || 0) ? current : highest;
  }, matches[0]);
}

/**
 * Search cities using fast multi-factor scoring:
 * - Exact name / alias match
 * - Prefix match
 * - Word boundary match
 * - Substring match on country, state, or timezone
 * - Typo tolerance via edit distance
 * - Population weighting (logarithmic)
 * 
 * @param {string} query - Search input
 * @param {Object} [options]
 * @param {number} [options.limit=10] - Maximum results
 * @param {Array<Object>} [options.dataset] - Optional custom cities list
 * @param {string} [options.countryFilter] - 2-letter ISO country code
 * @returns {Array<Object>}
 */
export function searchCities(query, options = {}) {
  const { limit = 10, dataset = citiesData, countryFilter = null } = options;
  const q = normalizeText(query);

  // If query is empty, return top global hubs ranked by population
  if (!q) {
    const list = countryFilter
      ? dataset.filter((c) => c.countryCode.toLowerCase() === countryFilter.toLowerCase())
      : dataset;
    return [...list]
      .sort((a, b) => (b.population || 0) - (a.population || 0))
      .slice(0, limit);
  }

  const scoredResults = [];

  for (let i = 0; i < dataset.length; i++) {
    const city = dataset[i];

    if (countryFilter && city.countryCode.toLowerCase() !== countryFilter.toLowerCase()) {
      continue;
    }

    const normName = normalizeText(city.name);
    const normCountry = normalizeText(city.country);
    const normState = normalizeText(city.state);
    const normTz = normalizeText(city.timeZone);

    let matchScore = 0;

    // 1. Exact match on city name
    if (normName === q) {
      matchScore += 1000;
    }
    // 2. Exact match on aliases (e.g. "NYC", "SF", "BLR")
    else if (city.aliases && city.aliases.some((a) => normalizeText(a) === q)) {
      matchScore += 900;
    }
    // 3. Name starts with query (Prefix match)
    else if (normName.startsWith(q)) {
      matchScore += 600;
    }
    // 4. Alias starts with query
    else if (city.aliases && city.aliases.some((a) => normalizeText(a).startsWith(q))) {
      matchScore += 500;
    }
    // 5. Word boundary match in city name (e.g. "York" in "New York")
    else if (normName.includes(` ${q}`)) {
      matchScore += 400;
    }
    // 6. Substring match on city name
    else if (normName.includes(q)) {
      matchScore += 300;
    }
    // 7. Substring match on state / province
    else if (normState && normState.includes(q)) {
      matchScore += 200;
    }
    // 8. Substring match on country name
    else if (normCountry.includes(q)) {
      matchScore += 150;
    }
    // 9. Substring match on timezone name (e.g. "Tokyo", "London")
    else if (normTz.includes(q)) {
      matchScore += 100;
    }
    // 10. Typo tolerance (Levenshtein distance <= 2 for queries >= 4 chars)
    else if (q.length >= 4) {
      const dist = levenshteinDistance(q, normName.slice(0, q.length));
      if (dist === 1) {
        matchScore += 180;
      } else if (dist === 2) {
        matchScore += 90;
      }
    }

    // Only include if there was a match
    if (matchScore > 0) {
      // Add logarithmic population bonus so "London, UK" beats "London, Canada"
      const pop = city.population || 10000;
      const popScore = Math.log10(pop) * 15;
      const totalScore = matchScore + popScore;

      scoredResults.push({
        city,
        score: totalScore,
      });
    }
  }

  scoredResults.sort((a, b) => b.score - a.score);

  return scoredResults.slice(0, limit).map((item) => item.city);
}
