import type { ExhibitObject } from '@/scene/exhibitKit'
import type { PaletteToken } from '@/theme'
import { profile } from './profile'

export type BuildingProp = 'waterTank' | 'acUnit' | 'dish' | 'balcony' | 'chimney' | 'scooter' | 'hedge'

// Something in a plot's room that is also an entry in its list. The object is
// chosen from the generic kit by name; the words are this plot's own.
export type Exhibit = {
  id: string
  // The list label: two or three words.
  name: string
  // The accent one-liner in the panel. States an outcome, not a technology.
  claim: string
  body: string[]
  object: ExhibitObject
  // Text a surface draws, for objects that show figures ("value|caption").
  labels?: string[]
}

function exhibit(
  id: string,
  name: string,
  object: ExhibitObject,
  claim: string,
  body: string[],
  labels?: string[],
): Exhibit {
  return { id, name, object, claim, body, labels }
}

// A project's full story, opened from the first entry in its room: what it
// is, a few numbers worth knowing, how it works, and what it trades away.
export type PlotOverview = {
  intro: string[]
  // Shown large, and counted up when the panel opens: "87.8%", "0.55", "~120".
  facts: { value: string; label: string }[]
  sections: { title: string; body: string[] }[]
}

// The id the overview answers to in the address, beside the exhibits' own.
export const OVERVIEW_ID = 'overview'

export type Plot = {
  id: string
  plotNumber: string
  title: string
  // Inside the room, the left overlay reads: eyebrow ("Plot 02 · 2025"), the
  // room's headline, then a one-line subhead above the exhibit list.
  // The name in the tab bar, where space is short.
  shortName: string
  eyebrow: string
  roomHeadline: string
  subhead: string
  kind: "project" | "about" | "contact"
  tagline: string
  summary: string
  problem: string
  highlights: string[]
  stack: string[]
  links: { label: string; href: string }[]
  position: [number, number, number]
  rotation: number
  footprint: { w: number; d: number }
  floors: number
  // Roof shape and props are what make each building recognisable from the
  // overview, so they are chosen per plot rather than generated. Any prop may
  // go on any roof: the kit relocates the ones a pitched roof can't carry.
  roofStyle: 'gable' | 'hip' | 'flat' | 'terrace'
  props: BuildingProp[]
  // Theme token names, not colours. The roof is the plot's identity and must be
  // unique across plots; walls and trim may repeat.
  palette: { wall: PaletteToken; roof: PaletteToken; trim: PaletteToken }
  // Three per room. A room has two wall zones, each taking one wall or floor
  // object, and two places on the desk.
  exhibits: Exhibit[]
  overview?: PlotOverview
}

// Placement is derived, not hand-written: every plot on the ring is spaced
// evenly outside the road and turned to face the estate centre, so moving the
// ring never leaves a building pointing the wrong way.
type PlotDefinition = Omit<Plot, 'position' | 'rotation'>

const RING_RADIUS = 15.8
const RING_START_ANGLE = Math.PI * 0.12

function ringPlacement(index: number, total: number): Pick<Plot, 'position' | 'rotation'> {
  const angle = (index / total) * Math.PI * 2 + RING_START_ANGLE
  return {
    position: [Math.sin(angle) * RING_RADIUS, 0, Math.cos(angle) * RING_RADIUS],
    rotation: angle + Math.PI,
  }
}

const definitions: PlotDefinition[] = [
  {
    id: "opsdesk",
    plotNumber: "Plot 01",
    title: "OpsDesk",
    shortName: "OpsDesk",
    eyebrow: "Plot 01 · Internal tool",
    roomHeadline: "Requests that route themselves",
    subhead: "IT, procurement and leave requests, off spreadsheets and email.",
    kind: "project",
    tagline: "Workflow automation and request triage portal",
    summary:
      "An internal business application that automates IT, procurement and leave request workflows, with multi-level approvals and a classifier that routes each request to the right team.",
    problem:
      "Requests were tracked through spreadsheets and email. OpsDesk gives them one workflow, with approvals, roles, audit logs and automatic routing.",
    highlights: [
      "Multi-level approvals with JWT role-based access",
      "Classifier routes requests with ~85% accuracy",
      "Deployed on Render with CI/CD through GitHub Actions",
    ],
    stack: ["React", "TypeScript", "Node.js", "Express", "MongoDB", "MySQL", "Flask", "scikit-learn"],
    links: [{ label: "GitHub", href: "#" }],
    footprint: { w: 3.4, d: 2.8 },
    floors: 2,
    roofStyle: 'gable',
    props: ['chimney', 'scooter'],
    palette: { wall: 'sand', roof: 'clay', trim: 'ink' },
    exhibits: [
      exhibit('workflows', 'Request board', 'kanbanWall', 'Every request on one board, not in an inbox.', [
        'OpsDesk automates IT, procurement and leave request workflows, replacing tracking by spreadsheet and email. Each request moves through multi-level approvals.',
        'Role-based access control with JWT separates what employees, managers and admins can see and do. Request data is served by RESTful APIs in Node.js and Express, backed by MongoDB.',
      ]),
      exhibit('routing', 'Routing rack', 'statusRack', 'Incoming requests sent to the right team, about 85% of the time.', [
        'A TF-IDF and Logistic Regression text classifier, trained on about 2,000 labelled tickets, auto-categorises each incoming request and routes it to the right team with about 85% accuracy.',
        'The model is served through a Flask microservice alongside the Node.js backend.',
      ]),
      exhibit('audit', 'Audit ledger', 'stampLedger', 'Every approval on the record, with SLA reports from it.', [
        'Audit logs and SLA reporting live in a normalized MySQL schema, and SQL queries with joins, aggregations and indexes feed an analytics dashboard.',
        'OpsDesk also integrates the Google Sheets API and Nodemailer email alerts, ships with Jest unit tests and test documentation, and is deployed on Render with CI/CD through GitHub Actions.',
      ]),
    ],
    overview: {
      intro: [
        'OpsDesk is an internal business application that automates IT, procurement and leave request workflows, replacing tracking by spreadsheet and email.',
        'Requests move through multi-level approvals with role-based access for employees, managers and admins, and a text classifier routes each incoming request to the team that should handle it.',
      ],
      facts: [
        { value: "~85%", label: "routing accuracy on incoming requests" },
        { value: "~2,000", label: "labelled tickets the classifier learned from" },
        { value: "3", label: "workflows: IT, procurement and leave" },
        { value: "3", label: "roles: employee, manager and admin" },
      ],
      sections: [
        {
          title: "Workflows and approvals",
          body: [
            "Each request follows a multi-level approval path, and JWT-based role-based access control decides what employees, managers and admins can see and do. Request data is served by RESTful APIs in Node.js and Express, backed by MongoDB.",
          ],
        },
        {
          title: "Routing with a classifier",
          body: [
            "A TF-IDF and Logistic Regression text classifier, trained on about 2,000 labelled tickets, auto-categorizes incoming requests and routes them to the right team with about 85% accuracy. It is served through a Flask microservice alongside the Node.js backend.",
          ],
        },
        {
          title: "Data, reports and shipping",
          body: [
            "Audit logs and SLA reporting sit in a normalized MySQL schema, queried with joins, aggregations and indexes for an analytics dashboard. The app integrates the Google Sheets API and Nodemailer email alerts, is covered by Jest unit tests with test documentation, and deploys on Render with CI/CD through GitHub Actions.",
          ],
        },
      ],
    },
  },
  {
    id: "rewardmax",
    plotNumber: "Plot 02",
    title: "RewardMax",
    shortName: "RewardMax",
    eyebrow: "Plot 02 · Personal finance",
    roomHeadline: "Which card pays most, worked out for you",
    subhead: "A rewards optimizer that ranks offers against logged spend.",
    kind: "project",
    tagline: "Smart rewards and cashback optimizer",
    summary:
      "A rewards and cashback optimizer that ranks offers across 12 reward categories by reward rate, monthly cap and logged spend.",
    problem:
      "Comparing reward offers by hand is slow. RewardMax ranks them automatically, cutting manual comparison time by about 35%.",
    highlights: [
      "Formula-based optimization across 12 reward categories",
      "~150 requests per second at ~120ms average latency",
      "React spend dashboard",
    ],
    stack: ["React", "Node.js", "Express", "MongoDB", "Flask"],
    links: [{ label: "GitHub", href: "#" }],
    footprint: { w: 3.0, d: 3.0 },
    floors: 2,
    roofStyle: 'flat',
    props: ['dish', 'balcony'],
    palette: { wall: 'paper', roof: 'indigo', trim: 'ink' },
    exhibits: [
      exhibit('engine', 'Offer ranker', 'barTerminal', 'About 35% less time spent comparing offers.', [
        'At the centre of RewardMax is a formula-based rewards-optimization engine that ranks offers by reward rate, monthly cap and the spend a person has logged.',
        'Doing that ranking automatically cut manual comparison time by about 35%.',
      ]),
      exhibit('categories', 'Category board', 'tileBoard', 'Twelve reward categories, ranked on the same terms.', [
        'The engine covers 12 reward categories, each ranked on the same three measures: reward rate, monthly cap and logged spend.',
        'A React.js spend dashboard puts the logged spending in front of the user.',
      ]),
      exhibit('backend', 'Receipt cabinet', 'receiptCabinet', 'About 150 requests a second, at about 120ms.', [
        'Behind the dashboard is a Node.js and Express REST API backed by MongoDB, working alongside a Python Flask microservice.',
        'The backend sustains about 150 requests per second at about 120ms average latency.',
      ]),
    ],
    overview: {
      intro: [
        'RewardMax is a rewards and cashback optimizer. It ranks card offers across 12 reward categories by reward rate, monthly cap and the spend a person has actually logged, so the best offer for each purchase is worked out rather than compared by hand.',
      ],
      facts: [
        { value: "12", label: "reward categories ranked" },
        { value: "~35%", label: "less time spent comparing offers" },
        { value: "~150", label: "requests per second sustained" },
        { value: "~120 ms", label: "average latency under that load" },
      ],
      sections: [
        {
          title: "The optimization engine",
          body: [
            "A formula-based engine ranks offers on three measures, reward rate, monthly cap and logged spend, across all 12 categories. Doing that ranking automatically cut manual comparison time by about 35%.",
          ],
        },
        {
          title: "Built to take load",
          body: [
            "A Node.js and Express REST API backed by MongoDB works alongside a Python Flask microservice, sustaining about 150 requests per second at about 120 ms average latency, with a React.js spend dashboard on top.",
          ],
        },
      ],
    },
  },
  {
    id: "churnguard",
    plotNumber: "Plot 03",
    title: "ChurnGuard",
    shortName: "ChurnGuard",
    eyebrow: "Plot 03 · Customer analytics",
    roomHeadline: "Finding the customers about to leave",
    subhead: "A churn risk dashboard for relationship managers.",
    kind: "project",
    tagline: "Customer churn risk dashboard",
    summary:
      "An admin dashboard that scores every customer's churn risk from recency, frequency and spend, with a plain-English reason, so relationship managers call the right customers before they leave.",
    problem:
      "Relationship managers usually find out a customer has gone quiet after the account is already lost. ChurnGuard ranks customers by risk so outreach can start first.",
    highlights: [
      "Three RFM features into one logistic regression",
      "Every score explained by what drove it",
      "Synthetic training data, openly documented",
    ],
    stack: ["React", "Vite", "Node.js", "Express", "MongoDB", "Python", "scikit-learn", "Flask", "JWT"],
    links: [{ label: "GitHub", href: "https://github.com/vsingh3be24/churnguard" }],
    footprint: { w: 3.8, d: 2.6 },
    floors: 1,
    roofStyle: 'hip',
    props: ['acUnit', 'hedge'],
    palette: { wall: 'sand', roof: 'ochre', trim: 'ink' },
    exhibits: [
      exhibit('features', 'Customer records', 'matchedStack', 'Recency, frequency and spend: the three signals that matter.', [
        'Every customer is described by three classic customer-analytics features. Recency is the days since their last interaction of any kind; frequency is how many interactions they had in the last 90 days; monetary is how much they spent in those same 90 days.',
        'Recency is deliberately not capped. A customer silent for 200 days keeps a recency of 200 rather than 90, because that gap is the strongest churn signal there is. A customer with no interactions at all falls back to the days since they joined.',
      ]),
      exhibit('model', 'Risk monitor', 'lineMonitor', 'A model simple enough to explain every call.', [
        'The features feed a logistic regression. For a linear model, coefficient times scaled feature is exactly that feature\'s contribution to the prediction, not an approximation, which is what lets ChurnGuard tell a manager why a customer is at risk.',
        'Scores are banded low below 0.33, medium to 0.66 and high above, and each comes with a reason naming its main driver, such as "High recency (170 days since last activity) is the main driver."',
        'The model lives in a Flask service that only Node.js calls. Logging a new interaction rescores the customer in the same request, in a single round trip.',
      ]),
      exhibit('bands', 'Risk dials', 'meterPanel', 'Honest about where its numbers come from.', [
        'No real churn-labelled dataset was available, so the training data is built openly: 200 synthetic customers sampled from loyal, casual and disengaged segments, so their recency, frequency and spend move together the way real customers do.',
        'Labels come from a documented heuristic, weighting recency most, frequency next and spend least, with a little noise so customers near the line stay genuinely ambiguous. Because that heuristic is itself linear, the model recovers it almost perfectly, which proves the pipeline is wired correctly, not that it has discovered anything.',
        'Swap in real historical customers and real outcomes, and nothing downstream, the scaler, the model, the Flask service or the Node.js integration, needs to change.',
      ]),
    ],
    overview: {
      intro: [
        'ChurnGuard is an admin dashboard for relationship managers. It scores every customer\'s churn risk as low, medium or high, so a manager knows whom to call before they leave instead of finding out after the account has gone quiet.',
        'The score comes from three well-established features, recency, frequency and monetary value, fed into a logistic regression, and every prediction names the feature that drove it.',
      ],
      facts: [
        { value: "3", label: "RFM features behind every score" },
        { value: "200", label: "synthetic customers, openly documented" },
        { value: "~26%", label: "of them churned, a minority class" },
        { value: "3", label: "risk bands: low, medium and high" },
      ],
      sections: [
        {
          title: "Why logistic regression",
          body: [
            "Three features and one linear classifier, on purpose. Its explanations are exact, not approximations, and recency, frequency and spend already capture most of the useful signal in transactional data. A heavier model would trade away the interpretability that is the point of the tool for accuracy the data cannot support.",
          ],
        },
        {
          title: "Trained without leaking",
          body: [
            "The 200 customers are split 80/20, stratified because churn is the minority class. The scaler is fitted on the training split only, since fitting it on everything first would leak test statistics into training.",
          ],
        },
        {
          title: "What it trades away",
          body: [
            "The labels are synthetic, the most important caveat in the project. Three features cannot see churn drivers outside recency, frequency and spend, like one bad support experience. Risk is rescored on demand, not on a schedule, so a customer who simply goes quiet is re-evaluated only when something is logged or a rescore is triggered.",
          ],
        },
      ],
    },
  },
  {
    id: "smartlimit",
    plotNumber: "Plot 04",
    title: "SmartLimit",
    shortName: "SmartLimit",
    eyebrow: "Plot 04 · Credit risk",
    roomHeadline: "A credit limit you can explain",
    subhead: "Increase, keep, or flag, always with the reason.",
    kind: "project",
    tagline: "Explainable credit-limit recommendation engine",
    summary:
      "A recommendation engine that tells a card issuer's admin whether to increase a customer's limit, keep it, or flag them as risky, with a plain-English reason instead of a black-box score.",
    problem:
      "A credit decision has to be defensible to regulators, to the admin approving it and to the customer who asks why. SmartLimit keeps the whole reasoning in view.",
    highlights: [
      "95.0% accuracy on held-out profiles",
      "Reasons built from each feature's real contribution",
      "33 unit tests on the model",
    ],
    stack: ["React", "Vite", "Node.js", "Express", "MongoDB", "Python", "scikit-learn", "Flask", "JWT"],
    links: [
      { label: "Live demo", href: "https://smartlimit-client.onrender.com" },
      { label: "GitHub", href: "https://github.com/vsingh3be24/Smartlimit" },
    ],
    footprint: { w: 3.7, d: 3.2 },
    floors: 3,
    roofStyle: 'terrace',
    props: ['waterTank', 'dish'],
    palette: { wall: 'sand', roof: 'charcoal', trim: 'ink' },
    exhibits: [
      exhibit('weights', 'Feature weights', 'barTerminal', 'Three features, and you can see what each is worth.', [
        'Every customer is reduced to three behavioural features: spend trend, the last three months against the three before; average utilization of their limit over the last three months; and payment consistency, their on-time rate weighted 70% towards recent months.',
        'A linear regression, with standardization inside the same scikit-learn pipeline so training and serving can never drift apart, learns what each is worth. Payment consistency counts most (+0.219), utilization pulls the other way (−0.200), and spend trend helps a little (+0.074).',
      ]),
      exhibit('history', 'Payment history', 'receiptCabinet', 'The reason names what actually moved the score.', [
        'The regression\'s output is recalibrated to a 0 to 1 score and banded: safe at 0.65 and above, medium risk from 0.35, high risk below.',
        'The reason shown to the admin is built from each feature\'s signed contribution to that customer\'s score, not a canned template, so it always names what is really driving their number: "Their recent spending is consistent, utilization is low, and they\'ve paid on time 19 of 20 times."',
      ]),
      exhibit('service', 'Spend trend', 'lineMonitor', 'Three services, one source of truth for the maths.', [
        'A React dashboard shows portfolio stats, a risk histogram and a needs-attention panel; a sortable, filterable customer list; and each customer\'s spend and payment history with a recommendation to accept or reject.',
        'The Node.js API owns all data and JWT authentication. The Flask model service holds no database at all: Node sends it a customer\'s raw history, and it computes the features with the very same function the training script uses.',
      ]),
    ],
    overview: {
      intro: [
        'SmartLimit is an explainable credit-limit recommendation engine for a card issuer. An admin opens a customer\'s spend and payment history and gets a recommendation, increase the limit, keep it, or flag the customer as risky, with a plain-English reason rather than a black-box score.',
      ],
      facts: [
        { value: "95.0%", label: "accuracy on held-out profiles" },
        { value: "3", label: "behavioural features, fully interpretable" },
        { value: "33", label: "unit tests on the model" },
        { value: "100", label: "synthetic training profiles" },
      ],
      sections: [
        {
          title: "Why a linear model",
          body: [
            "Credit-limit decisions need to be explainable. A linear model's coefficients are the whole story, with no hidden interaction the admin cannot see, and trading a little raw predictive power for that is the right call: an admin who cannot explain a decision cannot defend it.",
          ],
        },
        {
          title: "How it was trained",
          body: [
            "One hundred synthetic customer profiles, with features deliberately decorrelated so each coefficient reflects that feature's own contribution. An 80/20 split, stratified by label, scores 95.0% on the held-out set against 96.2% on training, so it is not overfitting. The model's tests cover feature engineering, the 70/30 weighting and edge cases like zero spend, full utilization and no payment history.",
          ],
        },
        {
          title: "What it trades away",
          body: [
            "The training data is synthetic, so the magnitudes would need refitting on real outcomes before informing real decisions. It sees only each customer's own behaviour, nothing portfolio-wide like a recession. There is no retraining or drift monitoring yet, and accepting an increase applies a flat 20%, a placeholder for an issuer's real limit policy.",
          ],
        },
      ],
    },
  },
  {
    id: "finalsay",
    plotNumber: "Plot 05",
    title: "FinalSay",
    shortName: "FinalSay",
    eyebrow: "Plot 05 · Verification",
    roomHeadline: "Which notice is the real one?",
    subhead: "Checking a submitted notice against the official record.",
    kind: "project",
    tagline: "Cross-institution notice verification platform",
    summary:
      "A prototype that checks a notice a student submits against officially published notices, works out how the two relate, and keeps a tamper-evident record of it.",
    problem:
      "Notices get forwarded, edited and superseded until nobody is sure which version stands. FinalSay tells a student whether the one they have still holds.",
    highlights: [
      "Seven relationships between notices, unsure cases to a reviewer",
      "Personal data redacted before anything is stored",
      "Tamper-evident provenance with a daily Merkle tree",
    ],
    stack: ["Python", "FastAPI", "SQLAlchemy", "SQLite", "PostgreSQL", "React", "Vite", "PWA"],
    links: [{ label: "GitHub", href: "https://github.com/vsingh3be24/FinalSay" }],
    footprint: { w: 2.8, d: 3.2 },
    floors: 2,
    roofStyle: 'hip',
    props: ['balcony', 'waterTank'],
    palette: { wall: 'paper', roof: 'plum', trim: 'ink' },
    exhibits: [
      exhibit('notices', 'Notice board', 'posterBoard', 'Seven ways two notices can relate.', [
        'A student submits a notice as pasted text, a PDF or an image. FinalSay extracts its issuer, date, deadline, audience and action, and compares it against notices ingested from the institutions themselves.',
        'It then classifies how they relate: consistent, contradictory, superseded, corrected, extended, cancelled or unresolved. Those relationships are stored as relational edge rows, not in a graph database.',
      ]),
      exhibit('review', 'Version tree', 'versionTree', 'When it is unsure, a person decides, not the student.', [
        'Any prediction below a confidence of 0.6 becomes unresolved and goes to a reviewer queue, where a reviewer resolves or corrects it.',
        'An evaluation harness measures it properly: per-field extraction F1, relationship precision, recall and F1, false-confirmation and unresolved rates, a two-annotator benchmark with Cohen\'s kappa, and four baselines across temporal and institution holdout splits.',
      ]),
      exhibit('intake', 'Submission scanner', 'docScanner', 'Personal data never reaches storage.', [
        'Names, roll numbers, emails and phone numbers are redacted the moment a notice is extracted, before anything is stored or indexed. The notice table only has a column for redacted text, so the guarantee is enforced by structure, not by convention.',
        'Every notice gets a canonical SHA-256 hash, rolled into a daily Merkle tree and anchored to a local append-only hash chain, with the Polygon Amoy testnet as an opt-in alternative.',
      ]),
    ],
    overview: {
      intro: [
        'FinalSay is a prototype platform for verifying notices across institutions. A student submits a notice; FinalSay extracts and redacts it, compares it with officially ingested notices, classifies how the two relate in time, and records the result in a tamper-evident provenance trail.',
        'Predictions it is not confident about are never shown as answers. They go to a human reviewer instead.',
      ],
      facts: [
        { value: "7", label: "relationships a notice can have to the record" },
        { value: "0.6", label: "confidence below which a person decides" },
        { value: "4", label: "roles: student, reviewer, admin and issuer" },
        { value: "4", label: "baselines in the evaluation harness" },
      ],
      sections: [
        {
          title: "Six modules",
          body: [
            "A FastAPI backend over SQLAlchemy mirrors the design in six modules: ingestion through institution adapters and student submission; extraction and redaction; provenance; comparison with confidence gating; a reviewer console; and an evaluation harness. A React and Vite progressive web app gives each of the four roles its own routes.",
          ],
        },
        {
          title: "Runs anywhere, swaps cleanly",
          body: [
            "The comparison model, the provenance anchor and the institution adapters sit behind abstract interfaces. The defaults, an offline rule-based comparison, a local hash chain and SQLite, run with no paid keys and no external services; a HuggingFace zero-shot model, the Polygon testnet and PostgreSQL are each a setting away.",
          ],
        },
        {
          title: "What it trades away",
          body: [
            "It is a prototype. Image submissions need a Tesseract OCR engine and, without one, politely ask for the text instead, while PDFs and pasted text work fully. Retention of raw files is a stated policy rather than something the prototype enforces automatically.",
          ],
        },
      ],
    },
  },
  {
    id: "about",
    plotNumber: "About",
    title: "About",
    shortName: "About",
    eyebrow: "About · Thapar Institute",
    roomHeadline: "Vaishnavi, briefly",
    subhead: "Computer Engineering at Thapar, Batch of 2028.",
    kind: "about",
    tagline: "Who I am",
    summary: profile.about[0],
    problem: "",
    highlights: [],
    stack: [],
    links: [],
    footprint: { w: 4.2, d: 3.4 },
    floors: 1,
    roofStyle: 'gable',
    props: ['chimney', 'hedge'],
    palette: { wall: 'sand', roof: 'sage', trim: 'ink' },
    exhibits: [
      exhibit('coursework', 'Coursework', 'bookshelf', 'Computer Engineering, with an 8.82 CGPA.', [
        'I\'m studying for a B.Tech in Computer Engineering at Thapar Institute of Engineering and Technology, from August 2024 to May 2028, with a CGPA of 8.82.',
        'Coursework so far: Data Structures and Algorithms, Object-Oriented Programming, Operating Systems, Database Management Systems, Computer Networks and Software Engineering.',
      ]),
      exhibit('roles', 'Four roles', 'laptopDesk', 'Placements, a hall of 900 residents, alumni and a web team.', [
        'Since August 2025 I\'ve been a Student Placement Representative, coordinating between the placement cell and visiting companies on drive schedules and registrations, and a Proctor at Vahini Hall, responsible for student welfare, discipline and administration for 900+ residents.',
        'From September 2024 to March 2025 I organised alumni-student outreach events for 200+ students as a coordinator at the Student Alumni Interaction Cell, and on the Microsoft Learn Student Chapter web team I built the About Us and Timeline pages for Makethon-7 in HTML, CSS and JavaScript, for 300+ visitors.',
      ]),
      exhibit(
        'numbers',
        'Three numbers',
        'statsFrames',
        'Problem solving, and a few wins along the way.',
        [
          '140+ data structures and algorithms problems solved on LeetCode, a 1540 contest rating, and an 8.82 CGPA.',
          'In 2026, semifinalist in the Flipkart GRID 8.0 Software Development Challenge and Best Speaker at the Model United Nations Society. Before that: 2nd prize at the Thapar Quizzing Club GK Quiz and 3rd prize at Construct, Thapar Civil Society.',
        ],
        profile.stats.map((stat) => `${stat.value}|${stat.label}`),
      ),
    ],
  },
  {
    id: "contact",
    plotNumber: "Contact",
    title: "Contact",
    shortName: "Contact",
    eyebrow: "",
    roomHeadline: "",
    subhead: "",
    kind: "contact",
    tagline: "Get in touch",
    summary: "Placeholder summary. To be written in Phase 11.",
    problem: "",
    highlights: [],
    stack: [],
    links: [
      { label: "Email", href: `mailto:${profile.email}` },
      { label: "GitHub", href: profile.github },
      { label: "LinkedIn", href: profile.linkedin },
    ],
    footprint: { w: 2.0, d: 2.0 },
    floors: 1,
    roofStyle: 'flat',
    props: [],
    // The noticeboard, not a building, so its swatch is deliberately neutral
    // rather than borrowing a roof identity that belongs to a plot.
    palette: { wall: 'sand', roof: 'ink', trim: 'ink' },
    // The noticeboard has no room to enter.
    exhibits: [],
  },
]

// The noticeboard stands in the central park rather than on the ring, so it is
// placed directly and takes no driveway.
const CONTACT_PLACEMENT: Pick<Plot, 'position' | 'rotation'> = {
  position: [3.4, 0, 4.2],
  rotation: Math.PI * 0.18,
}

const ringDefinitions = definitions.filter((plot) => plot.kind !== 'contact')

export const plots: Plot[] = definitions.map((definition) => {
  if (definition.kind === 'contact') return { ...definition, ...CONTACT_PLACEMENT }
  const index = ringDefinitions.indexOf(definition)
  return { ...definition, ...ringPlacement(index, ringDefinitions.length) }
})
