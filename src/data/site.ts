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
  // The sections below the estate.
  projectsHeading: 'Projects',
  projectsIntro: 'The same work as the buildings above, for reading rather than exploring.',
  walkInside: 'Walk inside',
  contactLine: 'Reach out by email, or find me on GitHub and LinkedIn.',
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
