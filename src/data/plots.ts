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
    tagline: "Customer loyalty and churn risk dashboard",
    summary:
      "A churn risk dashboard that scores customers with a Logistic Regression model over RFM features and bands them by risk, so relationship managers know whom to reach first.",
    problem:
      "Relationship managers can't reach every customer at once. ChurnGuard ranks customers by churn risk to help prioritise outreach.",
    highlights: [
      "RFM feature pipeline over ~5,000 customer records",
      "87% accuracy and a 0.84 F1-score",
      "~18% of 900+ accounts flagged as high-risk",
    ],
    stack: ["React", "Node.js", "Express", "MongoDB", "Python", "scikit-learn", "Pandas", "NumPy"],
    links: [{ label: "GitHub", href: "#" }],
    footprint: { w: 3.8, d: 2.6 },
    floors: 1,
    roofStyle: 'hip',
    props: ['acUnit', 'hedge'],
    palette: { wall: 'sand', roof: 'ochre', trim: 'ink' },
    exhibits: [
      exhibit('features', 'Customer records', 'matchedStack', 'Five thousand customer records, turned into signals.', [
        'ChurnGuard starts with an RFM-based feature-engineering pipeline, built in Pandas and NumPy over about 5,000 customer records.',
        'RFM stands for recency, frequency and monetary value: how recently, how often and how much each customer buys. Those features are what the model learns churn risk from.',
      ]),
      exhibit('model', 'Risk monitor', 'lineMonitor', '87% accuracy, and an F1-score of 0.84.', [
        'A Logistic Regression classifier trained on those features reaches 87% accuracy and a 0.84 F1-score.',
        'Its results are exposed through an Express.js REST API and followed on a React.js monitoring dashboard.',
      ]),
      exhibit('bands', 'Risk dials', 'meterPanel', 'The riskiest customers, flagged for outreach first.', [
        'Customers are banded into low, medium and high risk. Across 900+ accounts, about 18% were flagged as high-risk.',
        'The bands are there to help relationship managers prioritise outreach, starting with the customers most likely to leave.',
      ]),
    ],
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
          'In 2026, semifinalist in the Flipkart GRID 8.0 Software Development Challenge and Best Speaker at the Model United Nations Society. Before that: gold at the Inter-University Girls\' Badminton at PEC Chandigarh, 2nd prize at the Thapar Quizzing Club GK Quiz, and 3rd prize at Construct, Thapar Civil Society.',
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
