import { OVERVIEW_ID, plots } from '@/data/plots'
import { useEstate } from '@/store/useEstate'

// Each level has an address, so a single project can be linked to from an
// application: #/spendsense opens its room, #/spendsense/receipts one of its
// exhibits, and no hash at all is the campus. Moving between levels pushes a
// history entry, so the browser's back and forward walk the same steps.

type Route = { plotId: string | null; exhibitId: string | null }

// Anything that isn't a real room or exhibit resolves to the nearest level
// that is, rather than to an empty state.
function parse(hash: string): Route {
  const [plotPart, exhibitPart] = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const plot = plots.find((entry) => entry.id === plotPart && entry.exhibits.length > 0)
  if (!plot) return { plotId: null, exhibitId: null }
  if (exhibitPart === OVERVIEW_ID && plot.overview) return { plotId: plot.id, exhibitId: OVERVIEW_ID }
  const exhibit = plot.exhibits.find((entry) => entry.id === exhibitPart)
  return { plotId: plot.id, exhibitId: exhibit?.id ?? null }
}

function current(): Route {
  const { activePlotId, activeExhibitId } = useEstate.getState()
  return { plotId: activePlotId, exhibitId: activePlotId ? activeExhibitId : null }
}

function urlFor(route: Route): string {
  const base = `${window.location.pathname}${window.location.search}`
  if (!route.plotId) return base
  return route.exhibitId ? `${base}#/${route.plotId}/${route.exhibitId}` : `${base}#/${route.plotId}`
}

function apply(route: Route) {
  const state = useEstate.getState()
  if (!route.plotId) {
    if (state.activePlotId) state.backToCampus()
    return
  }
  if (state.activePlotId !== route.plotId) state.goToPlot(route.plotId)
  const { activeExhibitId, goToExhibit, backToInterior } = useEstate.getState()
  if (route.exhibitId && activeExhibitId !== route.exhibitId) goToExhibit(route.exhibitId)
  if (!route.exhibitId && activeExhibitId) backToInterior()
}

let started = false

// Runs once, before the first render, so a deep link is the state the page
// renders with: the camera starts in the room rather than flying to it.
export function startRouting(): void {
  if (started) return
  started = true

  apply(parse(window.location.hash))
  // An unknown or partly-wrong link is rewritten to what actually opened.
  window.history.replaceState(window.history.state, '', urlFor(current()))

  let following = false
  const follow = () => {
    following = true
    apply(parse(window.location.hash))
    following = false
    window.history.replaceState(window.history.state, '', urlFor(current()))
  }
  window.addEventListener('popstate', follow)
  window.addEventListener('hashchange', follow)

  useEstate.subscribe((state, previous) => {
    if (following) return
    const changed =
      state.activePlotId !== previous.activePlotId || state.activeExhibitId !== previous.activeExhibitId
    if (!changed) return
    const url = urlFor(current())
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.pushState(null, '', url)
    }
  })
}
