// Words the site itself says, as opposed to what it says about its owner.
// Kept here so a second instance can rewrite them without touching a component.
export const site = {
  // The theme a first-time visitor sees. A visitor who toggles keeps their
  // choice on later visits. index.html mirrors this for the first paint.
  defaultTheme: 'dusk' as 'day' | 'dusk',
  // Shown above the counter while the estate loads.
  loadingLine: 'Laying out the estate',
  // The first-run card: what this is, then how to use it.
  orientation: [
    'Each building on this estate is a project.',
    'Drag to look around, then click one to step inside.',
  ],
  orientationDismiss: 'Got it',
  // The last destination in the list, which opens the PDF rather than a room.
  resumeLabel: 'My resume',
  // The first entry in every project's room, and the heading over its tools.
  overviewLabel: 'Overview',
  builtWith: 'Built with',
  // Beside the name: what the person is looking for, with a live dot.
  availability: 'Open to Application Engineering internships',
  // Under the introduction, while the campus is showing.
  scrollCue: 'The full story is below',
  // The sections below the estate: a short label for the eyebrow, and a title.
  sections: {
    about: { label: 'About', title: 'A little about me' },
    projects: {
      label: 'Projects',
      title: 'Selected work',
      intro: 'The same work as the buildings above, for reading rather than exploring.',
    },
    skills: { label: 'Skills', title: 'What I work with' },
    timeline: { label: 'Timeline', title: 'So far' },
    contact: { label: 'Contact', title: "Let's talk" },
  },
  walkInside: 'Walk inside',
  contactLine: 'Reach out by email, or find me on GitHub and LinkedIn.',
  backToTop: 'Back to top',
  builtNote: 'Built with React, three.js and React Three Fiber.',
  // The way out of a room. The short form is for phones, where the long one
  // would run into the wordmark.
  backLabel: 'Back to the society',
  backLabelShort: 'Back',
  // Under the tab bar. Touch has no scroll wheel.
  hintPointer: 'Drag to rotate · Scroll to zoom',
  hintTouch: 'Drag to rotate · Pinch to zoom',
  // On touch, the tap that lets the estate be rotated.
  tapToExplore: 'Tap to explore',
} as const
