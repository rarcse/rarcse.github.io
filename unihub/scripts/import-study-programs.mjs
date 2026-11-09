#!/usr/bin/env node
/**
 * Transform MyGermanUniversity study-programs.json into UniHub artefacts:
 * - src/courses.js (English-taught / bilingual programmes → UNIHUB_DATA)
 * - data/universities.json (+ js/universities-data.js) with programme counts
 *   and an "All" universities tab
 *
 * Usage:
 *   node unihub/scripts/import-study-programs.mjs
 *   node unihub/scripts/import-study-programs.mjs /path/to/study-programs.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const DEFAULT_INPUTS = [
  path.join(root, "data/raw/study-programs.json"),
  "/home/ridwan/Downloads/study-programs.json",
];

const LANG_LABELS = {
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  ru: "Russian",
  zh: "Chinese",
  pt: "Portuguese",
  nl: "Dutch",
  ja: "Japanese",
  pl: "Polish",
  tr: "Turkish",
  da: "Danish",
  sv: "Swedish",
  uk: "Ukrainian",
  cs: "Czech",
  fi: "Finnish",
  el: "Greek",
  nb: "Norwegian",
  he: "Hebrew",
  ga: "Irish",
  ro: "Romanian",
  hu: "Hungarian",
};

const DEGREE_LABELS = {
  1: "Bachelor's",
  2: "Master's",
  3: "PhD / Doctorate",
  4: "Graduate school",
  5: "Prep course",
  6: "Language course",
  7: "Short course",
  8: "Joint / double degree",
  10: "Admission requirements",
  11: "State Examination",
  12: "Other degree",
};

/** Extra German/Latin keywords → same English subject labels used by SUBJECT_GROUPS. */
const SUBJECT_HINTS = [
  [/informatik|computerwissenschaft|computational/i, "Computer Science"],
  [/künstliche intelligenz|kuenstliche intelligenz|\bki\b|machine learning|datenwissenschaft|data science/i, "AI & Data Science"],
  [/software/i, "Software Engineering"],
  [/wirtschaftsinformatik|information systems|informationstechnologie|\bit\b/i, "Information Systems & IT"],
  [/bioinformatik|medizininformatik|geoinformatik|medieninformatik/i, "Bio, Medical & Media Informatics"],
  [/elektrotechnik|elektrisch/i, "Electrical Engineering"],
  [/elektronik|mikroelektronik/i, "Electronics"],
  [/maschinenbau|mechanical/i, "Mechanical Engineering"],
  [/mechatronik|robotik/i, "Mechatronics & Robotics"],
  [/fahrzeug|automobil|automotive/i, "Automotive Engineering"],
  [/bauingenieurwesen|civil engineering|verkehrswesen/i, "Civil Engineering"],
  [/architektur|städtebau|staedtebau|stadtplanung/i, "Architecture & Planning"],
  [/verfahrenstechnik|chemieingenieurwesen|chemical engineering/i, "Process & Chemical Engineering"],
  [/werkstoff|materialwissenschaft|materials/i, "Materials Science"],
  [/umwelttechnik|umweltwissenschaft|nachhaltigkeit|sustainability|ökologie|oekologie/i, "Earth & Environmental Sciences"],
  [/energietechnik|erneuerbare/i, "Renewable Energy"],
  [/betriebswirtschaft|bwl|management|managem|wirtschaftswissenschaft|volkswirtschaft|vwl|ökonomie|oekonomie|wirtschaftsingenieur/i, "Business Administration"],
  [/finanz|accounting|auditing|buchhaltung|banking/i, "Finance & Accounting"],
  [/marketing|vertrieb/i, "Marketing"],
  [/logistik|transport/i, "Logistics & Transport"],
  [/tourismus|hotel/i, "Tourism & Hospitality"],
  [/rechtswissenschaft|\brecht\b|jura|law/i, "Law"],
  [/mathematik|statistik|\bmath\b/i, "Mathematics & Statistics"],
  [/physik|astronomie/i, "Physics & Astronomy"],
  [/chemie|biochemie/i, "Chemistry"],
  [/biologie|biotech|biowissenschaft|life science/i, "Biology & Life Sciences"],
  [/medizin|gesundheit|pflege|pharmazie|zahnmedizin|nursing|health|nursing/i, "Medicine & Health"],
  [/psychologie|psychol/i, "Psychology"],
  [/politikwissenschaft|political/i, "Political Science"],
  [/soziologie|sozialarbeit|sozialwesen|soziale arbeit/i, "Sociology & Social Work"],
  [/pädagogik|paedagogik|erziehung|lehramt|bildungswissenschaft|erwachsenenbildung|gymnasium|grundschule/i, "Education & Pedagogy"],
  [/geschichte|archäologie|archaeologie/i, "History & Archaeology"],
  [/philosophie|theologie|religion|ethik|theol|philoso/i, "Philosophy, Religion & Ethics"],
  [/linguistik|literaturwissenschaft|sprachwissenschaft/i, "Linguistics & Literature"],
  [/germanistik|anglistik|amerikanistik|deutsch/i, "German & English Studies"],
  [/kunst|design|musik|medien|film|journalismus|kommunikation|fotografie|theater|flöte|flote|accessory/i, "Art, Design & Media"],
  [/agrar|forst|gartenbau|landwirtschaft/i, "Agriculture & Forestry"],
  [/geographie|geologie|geowissenschaft/i, "Earth & Environmental Sciences"],
  [/industrial engineering|advanced industrial|produktion|fertigung|manufactur/i, "Mechanical Engineering"],
  [/digital|information technol|informationstechnol/i, "Information Systems & IT"],
  [/nachhaltig|sustainable|green engineering|mineral resources/i, "Earth & Environmental Sciences"],
  [/optical|optik|photon/i, "Physics & Astronomy"],
  [/kultur|cultural/i, "Cultural & Intercultural Studies"],
  [/international relations|internationale beziehungen/i, "International Relations"],
  [/aerospace|aircraft|flight|luftfahrt|raumfahrt/i, "Aerospace, Marine & Transport"],
  [/\bai\b|artificial intelligence|autonome? systems/i, "AI & Data Science"],
  [/ägyptolog|agyptolog|egyptolog|koptolog/i, "Asian, African & Area Studies"],
  [/akkordeon|klavier|geige|violine|gesang|orchester|komposition|dirigate/i, "Art, Design & Media"],
  [/logopäd|sprachtherapie|speech therapy/i, "Medicine & Health"],
  [/abfall|altlast|waste|water process|air quality/i, "Earth & Environmental Sciences"],
  [/3d-?druck|additive|oberflächen|oberflachen/i, "Materials Science"],
];

function resolveInput() {
  const arg = process.argv[2];
  if (arg) {
    const abs = path.resolve(arg);
    if (!fs.existsSync(abs)) throw new Error(`Input not found: ${abs}`);
    return abs;
  }
  for (const candidate of DEFAULT_INPUTS) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    "study-programs.json not found. Pass a path or place it at unihub/data/raw/study-programs.json"
  );
}

function loadCityCoords() {
  const coordsPath = path.join(root, "src/city-coords.js");
  const code = fs.readFileSync(coordsPath, "utf8");
  const match = code.match(/window\.UNIHUB_CITY_COORDS\s*=\s*(\{[\s\S]*\});?\s*$/);
  if (!match) throw new Error("Could not parse city-coords.js");
  return JSON.parse(match[1]);
}

function normalizeCityKey(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CITY_ALIASES = {
  cologne: "Köln",
  munich: "München",
  nuremberg: "Nürnberg",
  nurnberg: "Nürnberg",
  hanover: "Hannover",
  brunswick: "Braunschweig",
  frankfort: "Frankfurt am Main",
  "frankfurt main": "Frankfurt am Main",
  "munster": "Münster",
  "goettingen": "Göttingen",
  "gottingen": "Göttingen",
  "duesseldorf": "Düsseldorf",
  dusseldorf: "Düsseldorf",
  "saarbrucken": "Saarbrücken",
  "lubeck": "Lübeck",
  "lueneburg": "Lüneburg",
  "tuebingen": "Tübingen",
  "wurzburg": "Würzburg",
  "wuerzburg": "Würzburg",
};

function buildCityIndex(coords) {
  const exact = new Map();
  const normalized = new Map();
  for (const [name, value] of Object.entries(coords)) {
    exact.set(name, value);
    const key = normalizeCityKey(name);
    if (!normalized.has(key)) normalized.set(key, { name, ...value });
  }
  for (const [alias, real] of Object.entries(CITY_ALIASES)) {
    if (coords[real] && !normalized.has(alias)) {
      normalized.set(alias, { name: real, ...coords[real] });
    }
  }
  return { exact, normalized };
}

function lookupCity(cityName, cityIndex) {
  if (!cityName) return { name: "", lat: null, lng: null };
  if (cityIndex.exact.has(cityName)) {
    const c = cityIndex.exact.get(cityName);
    return { name: cityName, lat: c.lat, lng: c.lng };
  }
  const key = normalizeCityKey(cityName);
  if (cityIndex.normalized.has(key)) return cityIndex.normalized.get(key);
  // prefix / contains soft match
  for (const [nKey, value] of cityIndex.normalized) {
    if (nKey.startsWith(key) || key.startsWith(nKey)) return value;
  }
  return { name: cityName, lat: null, lng: null };
}

function degreeType(degrees) {
  const list = degrees || [];
  let bachelor = false;
  let master = false;
  let stateExam = false;
  for (const d of list) {
    const shortName = String(d.short_name || "");
    const name = String(d.name || "").toLowerCase();
    if (
      shortName.startsWith("B.") ||
      shortName === "LL.B." ||
      shortName === "BA.pth." ||
      shortName === "Dipl." ||
      shortName === "Dipl. (FH)" ||
      name.includes("bachelor") ||
      name.includes("foundation year")
    ) {
      bachelor = true;
    }
    if (
      shortName.startsWith("M.") ||
      shortName === "MBA" ||
      shortName === "EMBA" ||
      shortName === "LL.M." ||
      shortName === "Magister" ||
      shortName === "Laurea Magistrale" ||
      name.includes("master") ||
      name.includes("magister")
    ) {
      master = true;
    }
    if (shortName === "State Examination" || name.includes("state examination")) {
      stateExam = true;
    }
  }
  if (bachelor && !master) return 1;
  if (master && !bachelor) return 2;
  if (bachelor) return 1;
  if (master) return 2;
  if (stateExam) return 11;
  if (list.length) return 12;
  return 12;
}

function loadSubjectLeaves() {
  const appPath = path.join(root, "src/app.js");
  const app = fs.readFileSync(appPath, "utf8");
  const start = app.indexOf("const SUBJECT_GROUPS = ");
  if (start < 0) throw new Error("SUBJECT_GROUPS not found in app.js");
  const end = app.indexOf("\n];", start);
  if (end < 0) throw new Error("SUBJECT_GROUPS end not found");
  const block = app.slice(start, end + 3);
  const groups = new Function(`${block}\nreturn SUBJECT_GROUPS;`)();
  const leaves = [];
  for (const group of groups) {
    if (group.children?.length) leaves.push(...group.children);
    else leaves.push(group);
  }
  return leaves;
}

/** Collapse Cyrillic/Greek lookalikes used in scraped programme titles. */
function normalizeHomoglyphs(value) {
  const map = {
    а: "a",
    А: "A",
    е: "e",
    Е: "E",
    о: "o",
    О: "O",
    р: "p",
    Р: "P",
    с: "c",
    С: "C",
    у: "y",
    У: "Y",
    х: "x",
    Х: "X",
    і: "i",
    І: "I",
    ї: "i",
    Ї: "I",
    ј: "j",
    Ј: "J",
    ѕ: "s",
    Ѕ: "S",
    һ: "h",
    Һ: "H",
    ο: "o",
    Ο: "O",
    α: "a",
    Α: "A",
    ε: "e",
    Ε: "E",
    ι: "i",
    Ι: "I",
    ν: "v",
    Ν: "N",
    ρ: "p",
    Ρ: "P",
    τ: "t",
    Τ: "T",
    υ: "y",
    Υ: "Y",
    χ: "x",
    Χ: "X",
    κ: "k",
    Κ: "K",
    μ: "m",
    Μ: "M",
    β: "b",
    Β: "B",
  };
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u00ad\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/./g, (ch) => map[ch] || ch);
}

function inferSubject(name, leaves) {
  const text = normalizeHomoglyphs(name);
  if (!text) return "Other";
  for (const leaf of leaves) {
    if ((leaf.patterns || []).some((re) => re.test(text))) return leaf.label;
  }
  for (const [re, label] of SUBJECT_HINTS) {
    if (re.test(text)) return label;
  }
  return "Other";
}

function languageLabels(langs) {
  const out = [];
  const seen = new Set();
  for (const lang of langs || []) {
    const code = lang.code || "";
    const label = LANG_LABELS[code] || lang.name || code;
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

function formatMoneyToken(token) {
  const cleaned = String(token).replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (Number.isNaN(n)) return null;
  return Math.round(n).toLocaleString("en-US");
}

function formatFees(program) {
  const info = program.tuition_fee_info || {};
  const label = info.tuition_fee == null ? "" : String(info.tuition_fee).trim();
  if (!label || /^free$/i.test(label)) {
    const eu = program.tuition_fee_eu_min;
    const non = program.tuition_fee_non_eu_min;
    if ((eu == null || eu === 0) && (non == null || non === 0)) return "No tuition fees";
    if (eu != null && eu > 0) return Number(eu).toLocaleString("en-US");
    if (non != null && non > 0) return Number(non).toLocaleString("en-US");
    return "No tuition fees";
  }

  // Preserve ranges like "1500 / 2500" or "1000-2000"
  if (/[\/–—-]/.test(label) && /\d/.test(label)) {
    const parts = label.split(/\s*[\/–—-]\s*/).map(formatMoneyToken).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]} – ${parts[1]}`;
    if (parts.length === 1) return parts[0];
  }

  if (/^\d/.test(label)) {
    const formatted = formatMoneyToken(label);
    if (formatted) return formatted;
  }

  const eu = program.tuition_fee_eu_min;
  const non = program.tuition_fee_non_eu_min;
  if (eu != null && eu > 0) return Number(eu).toLocaleString("en-US");
  if (non != null && non > 0) return Number(non).toLocaleString("en-US");
  return label || "Tuition varies";
}

function formatBeginning(deadline, openAllYear) {
  if (openAllYear) return "Other";
  const dates = (deadline && deadline.dates) || {};
  const winter = Boolean(dates.winter);
  const summer = Boolean(dates.summer);
  if (winter && summer) return "Winter semester, Summer semester";
  if (winter) return "Winter semester";
  if (summer) return "Summer semester";
  if (dates.spring || dates.autumn) return "Trimester and quarter";
  return "Other";
}

function formatDeadline(deadline, openAllYear) {
  if (openAllYear) return "Open all year";
  const dates = (deadline && deadline.dates) || {};
  const parts = [];
  if (dates.winter) parts.push(`Winter: ${dates.winter}`);
  if (dates.summer) parts.push(`Summer: ${dates.summer}`);
  if (dates.next_date) parts.push(`Next: ${dates.next_date}`);
  if (!parts.length) return null;
  return parts.join(" · ");
}

function formatDuration(program) {
  const sem = program.no_semester || program.duration;
  if (!sem) return null;
  const max = program.no_semester_max || program.duration_max;
  if (max && max !== sem) return `${sem}–${max} semesters`;
  return `${sem} semester${sem === 1 ? "" : "s"}`;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), "en", { sensitivity: "base" })
  );
}

function mapProgram(program, cityIndex, subjectLeaves) {
  const type = degreeType(program.degrees);
  const uni = (program.universities || [])[0] || {};
  const cityRaw =
    ((program.cities || [])[0] &&
      ((program.cities || [])[0].name_en || (program.cities || [])[0].name)) ||
    ((uni.cities || [])[0] && ((uni.cities || [])[0].name_en || (uni.cities || [])[0].name)) ||
    "";
  const cityHit = lookupCity(cityRaw, cityIndex);
  const languages = languageLabels(program.program_languages);
  const subject = inferSubject(program.name, subjectLeaves);

  return {
    id: program.id,
    name: program.name,
    academy: uni.name_en || uni.short_name || "Unknown university",
    city: cityHit.name || cityRaw || "",
    languages: languages.length ? languages : ["Other teaching language"],
    beginning: formatBeginning(program.application_deadline_info, program.application_open_all_year),
    duration: formatDuration(program),
    fees: formatFees(program),
    type,
    deadline: formatDeadline(program.application_deadline_info, program.application_open_all_year),
    subject,
    badge: null,
    image: null,
    link: program.access_link || null,
    support: null,
    lat: cityHit.lat,
    lng: cityHit.lng,
    _uniId: uni.id || null,
  };
}

function buildMeta(courses, cityCoords) {
  const cities = uniqueSorted(courses.map((c) => c.city));
  const academies = uniqueSorted(courses.map((c) => c.academy));
  const languages = uniqueSorted(courses.flatMap((c) => c.languages || []));
  const beginnings = uniqueSorted(courses.map((c) => c.beginning));
  const subjects = uniqueSorted(courses.map((c) => c.subject).filter(Boolean));

  let citiesWithCoords = 0;
  let coursesWithCoords = 0;
  for (const course of courses) {
    if (course.lat != null && course.lng != null) {
      coursesWithCoords += 1;
      if (cityCoords[course.city] || true) citiesWithCoords += 1;
    }
  }
  const citiesWithCoordsCount = cities.filter((city) => {
    const hit = cityCoords[city];
    return hit && hit.lat != null;
  }).length;

  return {
    numResults: courses.length,
    degreeLabels: DEGREE_LABELS,
    cities,
    subjects,
    academies,
    languages,
    beginnings,
    citiesWithCoords: citiesWithCoordsCount,
    coursesWithCoords,
  };
}

function aggregateUniversities(programs) {
  const byId = new Map();
  for (const program of programs) {
    for (const uni of program.universities || []) {
      if (!uni || uni.id == null) continue;
      let entry = byId.get(uni.id);
      if (!entry) {
        const city =
          ((uni.cities || [])[0] && (uni.cities[0].name_en || uni.cities[0].name)) ||
          ((program.cities || [])[0] && (program.cities[0].name_en || program.cities[0].name)) ||
          "";
        entry = {
          id: uni.id,
          name: uni.name_en || uni.short_name || `University ${uni.id}`,
          logo: uni.logo_path || null,
          link: uni.access_link || null,
          programs: 0,
          city,
        };
        byId.set(uni.id, entry);
      }
      entry.programs += 1;
      if (!entry.logo && uni.logo_path) entry.logo = uni.logo_path;
      if (!entry.link && uni.access_link) entry.link = uni.access_link;
    }
  }
  return byId;
}

function enrichUniversitiesJson(uniAgg) {
  const uniPath = path.join(root, "data/universities.json");
  const payload = JSON.parse(fs.readFileSync(uniPath, "utf8"));
  const tabs = payload.tabs || [];

  for (const tab of tabs) {
    if (tab.key === "all") continue;
    for (const item of tab.items || []) {
      const agg = uniAgg.get(item.id);
      if (!agg) continue;
      item.programs = agg.programs;
      if (!item.logo && agg.logo) item.logo = agg.logo;
      if (!item.link && agg.link) item.link = agg.link;
    }
  }

  const rankedIds = new Set();
  for (const tab of tabs) {
    if (tab.key === "all") continue;
    for (const item of tab.items || []) rankedIds.add(item.id);
  }

  const allItems = [...uniAgg.values()]
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "en", { sensitivity: "base" }))
    .map((u) => ({
      id: u.id,
      rank: rankedIds.has(u.id) ? "Ranked" : "Directory",
      name: u.name,
      logo: u.logo,
      ranking: null,
      type: "University",
      control: null,
      tuition: null,
      students: null,
      programs: u.programs,
      link: u.link,
      city: u.city || null,
    }));

  const withoutAll = tabs.filter((t) => t.key !== "all");
  withoutAll.push({
    key: "all",
    label: "All",
    items: allItems,
  });
  payload.tabs = withoutAll;

  fs.writeFileSync(uniPath, JSON.stringify(payload));
  const dataJs = path.join(root, "js/universities-data.js");
  fs.writeFileSync(dataJs, `window.UNIHUB_UNIVERSITIES=${JSON.stringify(payload)};\n`);
  return {
    rankingTabs: withoutAll.filter((t) => t.key !== "all").length,
    allCount: allItems.length,
  };
}

function writeCoursesJs(payload) {
  const outPath = path.join(root, "src/courses.js");
  const body = `window.UNIHUB_DATA = ${JSON.stringify(payload)};\n`;
  fs.writeFileSync(outPath, body);
  return outPath;
}

function main() {
  const input = resolveInput();
  console.log(`Reading ${input}`);
  const programs = JSON.parse(fs.readFileSync(input, "utf8"));
  if (!Array.isArray(programs)) throw new Error("Expected top-level array");

  const cityCoords = loadCityCoords();
  const cityIndex = buildCityIndex(cityCoords);
  const subjectLeaves = loadSubjectLeaves();

  const courses = [];
  for (const program of programs) {
    const mapped = mapProgram(program, cityIndex, subjectLeaves);
    if (mapped) courses.push(mapped);
  }

  courses.sort((a, b) =>
    String(a.name).localeCompare(String(b.name), "en", { sensitivity: "base" })
  );

  const meta = buildMeta(courses, cityCoords);
  const publicCourses = courses.map(({ _uniId, ...rest }) => rest);
  const coursesPath = writeCoursesJs({ meta, courses: publicCourses });
  const subjectCounts = publicCourses.reduce((acc, c) => {
    acc[c.subject] = (acc[c.subject] || 0) + 1;
    return acc;
  }, {});
  console.log(
    `Wrote ${coursesPath} (${publicCourses.length} programmes, ${meta.coursesWithCoords} with coords, ${meta.subjects.length} subjects)`
  );
  console.log(
    "Top subjects:",
    Object.entries(subjectCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")
  );

  const uniAgg = aggregateUniversities(programs);
  const uniStats = enrichUniversitiesJson(uniAgg);
  console.log(
    `Updated universities.json / universities-data.js (All tab: ${uniStats.allCount} universities)`
  );
}

main();
