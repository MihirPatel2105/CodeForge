# Live Agent City

Agent City is an optional view of an existing CodeForge run. Open **Agent City**
from the run header, or use **Watch in Agent City** while the agents are building.

The city has six buildings: PM, Architect, Coder, Reviewer, Tester, and Sandbox.
The Sandbox is the execution environment, not an additional AI agent. Building
states, pass numbers, approvals, handoffs, repair loops, and test results come
from the run's recorded events.

## Inspect a build

- Click a building or select its agent below the scene to inspect its output and
  activity. The controls below the scene also work with a keyboard.
- **Follow active agent** returns the inspector to the stage currently working.
- Requirements and design checkpoints link back to the existing run workspace.
  The city does not approve, restart, or modify a run.
- The Coder and Tester show their recorded file names and the latest saved source.
  The Sandbox shows recorded execution output and test counts.
- Camera controls support orbit, zoom, reset, and focusing on a building. Day and
  night are local display preferences. Pausing the city stops its animation while
  run events continue to arrive.

The page shares CodeForge's theme, typography, surfaces, and controls. Scene lighting
follows the page's light/dark theme until a day/night setting is explicitly chosen.
Repair notices and their paths use the same purple reserved for repair loops in
the run dashboard.

## Replay

**Replay run** rebuilds the city from the received event sequence. Play, pause,
seek, and 1×/2×/4× playback change only the view. Returning to live restores the
latest received state. Earlier replay positions show their own recorded evidence;
the latest saved source is withheld until the replay reaches the current end.
The run workspace remains the place to inspect archived source versions.

A labeled sample is available at `/playground/agent-city?demo=library`. It uses
the existing sample event recording and makes no backend or model requests.
An ordinary `/playground/agent-city` visit still opens the original island quest.

## Connection and accessibility

The observer uses the existing authenticated, same-origin run, file, and SSE
endpoints. It reconnects with `Last-Event-ID`, ignores duplicate event IDs, and
buffers finished runs until their terminal event arrives. An interrupted archived
recording resumes from its last event instead of briefly showing past work as live.
Access failures stop the observer and offer a retry.

Reduced motion disables ambient animation and camera easing. Animation also
suspends when the scene is out of view or the page is hidden. If WebGL cannot
initialize or is lost, a 2D building selector preserves access to every stage,
its evidence, and playback. Layouts support narrow screens down to 320 CSS pixels.

## Verification

The dedicated Agent City group in `.github/workflows/quality.yml` covers the
original playground, live stage changes and repairs, approvals, file inspection,
historical playback, reconnect and deduplication, access recovery, terminal
shutdown, and the narrow-screen reduced-motion fallback. These deterministic
checks exercise the real frontend with controlled backend event fixtures; they
do not claim that a new live model-generated build was performed.
