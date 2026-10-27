# PRD Amendment 6: hero prompt and delivery times (Oct 26)
- Demo prompt changed to: "Find and purchase a less than $500 snowboard that will arrive at my address in 2 days. I should be able to return it if it doesn't work for me." (Returns line added Oct 26 evening, approved by Sneha, so the live hero shows 2 problems: Budget and Returns.) It says nothing about shipping cost, on purpose: the "under $500" is ambiguous (item price vs. total).
- Store data: Burton and Nitro expedited = 2 days ($60). Free standard shipping = 5-7 days, except the Orca at 3 days (keeps Scenario B working with the Friday prompt). So only expedited can arrive in 2 days (Wed Oct 28).
- Hero now: Burton $449.95 + $60 expedited = $509.95, over the $500 cap. The customer wants it returnable and the Burton is Final Sale, so Returns is flagged too: 2 problems (Budget, Returns).
- Seeded receipt AR-2026-0041 / 12322 text and AR-2026-0043 snapshots still show old days (4 / 3). They are plain demo data and are unchanged.
- Needs DEMO_DATE = 2026-10-26 (or the real Monday) for "2 days" to mean Wed Oct 28.
