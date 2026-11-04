# The mods in Tycoon+

Tycoon+ is made of small mods. The installer adds all of them except `names`. With the Python install you can leave any out: `python install.py install --without rivals,board`.

| Name | What it does | Needs |
|---|---|---|
| `template` | "Start from a past model's specs" on the name screen: copies the specs and parts of a past model. The looks are left to the game's own "Copy the design of a past model" button, so the two work together. | |
| `speed` | Big, strong offices build faster. Start-ups are unchanged. | |
| `launch` | Launch a reviewed device today or plan a date, a "Ready to launch" shelf, and launch events for several devices at once. | |
| `difficulty` | Per-company sliders and presets for buying, part costs, research speed, competitors and build speed. Outside "Original", phone parts follow real dates and prices. | |
| `queue` | Design a device while another is in development. It waits in a queue and starts by itself. | `difficulty` |
| `rooms` | A button that steps through your three work offices. | |
| `pipeline` | Up to three items in development at once, one per work room. | `queue`, `rooms` |
| `next` | "Next: 90 Hz, May 2019" under design options that aren't out yet. | |
| `compare` | Compare two of your devices side by side. | |
| `sell` | Change a device's price or stop selling it. | |
| `skip` | Skip the delivery bar, review animations and presentation lines. Price forecast on the price page. | |
| `board` | One sales board with every device on sale. | |
| `news` | Bigger office news cards that stay clear of the work-room circles. | |
| `restock` | Auto / Careful / Off restocking per device. | |
| `fairprice` | Reviewers judge price against what the device offers in its year (not in "Original"). | |
| `year` | A year in review card every 1 January, and a Years tab on the stats page. | |
| `rivals` | Rival companies launch devices on believable dates, with a Rivals tab on the board. | |
| `editorperf` | No lag on quick taps in the phone and tablet editor. | |
| `researchfilter` | The device filter on the research screen stays picked across tabs. | |
| `bulkhire` | Run x2 to x20 searches at once on a Find Employees agency, for 50% more per search. | |
| `names` | **Off by default.** Real company and brand names instead of the game's parody names. | |

## About `names`

The game uses parody names on purpose, so this one is opt-in. All names and trademarks belong to their owners, and this project has no link to any of them.

## Game update 1.6

Tycoon+ is made for game update 1.6 (Steam build of 20 October 2026) and works with its new features:

- `assistant` is gone: the game now closes the presentation offer on "No" by itself.
- `template` sits under the game's new look copy and leaves the looks to it.
- `sell`: auto-marketing never spends money on a device you stopped selling.
- `restock` and `bulkhire`: their costs show in the stats page's Finance tab (Production and Hiring).
- `year`: revenue now includes OS income, as on the game's stats page, and the year's profit matches the Finance tab.
- `researchfilter`: "Research all" covers the cards on show, filter included. In sandbox mode it covers everything, as in the game.
- `bulkhire`: the new recruitment table counts a bulk search like one big search. Auto-hire is never multiplied.

## Known issues

- On office screens the build queue checks the game about once a second, which costs 3 to 4 ms per second.
- The gap between rival launch messages (at least a game week, at most two a month) is covered by tests but hasn't been seen in a long real game yet.
- If you save and reload between a batch delivery and its reviews, the queue counts the company as not busy. The original game drops that review too.
