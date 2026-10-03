/**
 * Curated demo content for the seed: fictional, plausible newsroom copy in
 * English, ten stories per category in `CATEGORIES`. Every story has its own
 * free Unsplash photo, chosen to match it and stored as a link (not a file).
 * Each story: { lang, title, abstract, lead, image }.
 */
const photo = (id) => `https://images.unsplash.com/${id}?w=800&h=450&fit=crop&q=80`;
const story = (title, abstract, lead, photoId) => ({ lang: 'en', title, abstract, lead, image: photo(photoId) });

export const STORIES = {
  politics: [
    story('Coalition Talks Stall Over Budget Priorities', 'Negotiators trade proposals as the deadline for the state budget approaches.', 'Party leaders met late into the night but left without a deal on how to split next year\'s spending between defense, housing and transport.', 'photo-1729551610680-c6ea05b08937'),
    story('Finance Committee Approves Public Transport Budget', 'The new budget will expand night bus lines in the major cities.', 'Committee members approved the increase in a vote after a debate that lasted many hours, with reservations voiced by the opposition.', 'photo-1517606400858-ba377e7e66d7'),
    story('Local Elections: Turnout Expected to Hit a Decade High', 'Polling stations report early queues in several major cities.', 'Election officials say advance registration and a new mobile reminder service have lifted participation well above previous cycles.', 'photo-1782998307726-f93ec14eda24'),
    story('Knesset Passes Transparency Law in Second Reading', 'Donations to public bodies will have to be disclosed within seven days.', 'The bill passed with the support of 61 members of the Knesset and is expected to come up for its third reading next week.', 'photo-1768213022263-0414dc145dfd'),
    story('Mayors Call for Direct Funding of School Meals', 'A joint letter asks the government to bypass regional councils.', 'Twelve mayors argue that the current allocation model delays payments and leaves the poorest neighborhoods waiting for weeks.', 'photo-1573601792368-a93b4fb33643'),
    story('Prime Minister Meets European Union Leaders', 'The meeting focused on economic cooperation and renewable energy.', 'According to an official statement, the sides agreed to set up a joint team that will submit recommendations within six months.', 'photo-1594810205183-18a8b0ce6c13'),
    story('Civil Service Reform Draws Sharp Union Response', 'Unions warn of strikes if hiring rules change without consultation.', 'The proposal would shorten tenders and let ministries hire for temporary projects without a full public competition.', 'photo-1569182409034-703dd1c97e79'),
    story('State Comptroller Finds Flaws in Infrastructure Project Management', 'The report points to repeated budget overruns in road works.', 'According to the report, four of the five projects examined finished an average of eight months late.', 'photo-1529792083865-d23889753466'),
    story('Parliament Debates Voting Age for Local Elections', 'A bipartisan bill proposes lowering the age to sixteen.', 'Supporters say early participation builds lifelong civic habits; critics question whether teenagers have enough independence from family pressure.', 'photo-1534293230397-c067fc201ab8'),
    story('Opposition Parties File a No-Confidence Motion', 'The vote is expected early next week.', 'Opposition leaders argue that the government has lost its majority on core issues, but the coalition expects the motion to fail.', 'photo-1529107386315-e1a2ed48a620'),
  ],
  business: [
    story('Central Bank Holds Rates Steady for Third Meeting', 'Governor cites cooling inflation but warns of housing pressure.', 'Markets had priced in the decision, and the shekel barely moved after the announcement.', 'photo-1764983255241-3768b4df0c57'),
    story('Israeli Startup Raises $80 Million in Series C Round', 'The company develops cybersecurity solutions for the cloud.', 'The money will be used to expand operations in the US and to hire about 150 new employees over the coming year.', 'photo-1522071820081-009f0129c71c'),
    story('Small Businesses Struggle With Rising Commercial Rents', 'Shop owners in city centers report double-digit increases.', 'A survey of 400 retailers found that one in five is considering relocation or closure within the year.', 'photo-1687422808191-93810cd07ab0'),
    story('Housing Market: Apartment Prices Dip for the First Time in a Year', 'The decline is concentrated mainly in new apartments in outlying regions.', 'According to the Central Bureau of Statistics, the average apartment price fell by about half a percent over the past two months.', 'photo-1545324418-cc1a3fa10c00'),
    story('Retail Giant Unveils Plan to Halve Packaging Waste', 'New targets cover own-brand products by 2028.', 'The company says it will move to refillable containers in its grocery lines and cut plastic film use across all warehouses.', 'photo-1721138569305-bb394cb28029'),
    story('Airlines Add More Flights for the Summer', 'Demand for flights to Europe is breaking records.', 'The airport expects passenger numbers in the summer months to rise by about 12 percent compared with last year.', 'photo-1532968899863-5b52ef155913'),
    story('Freelancers Push for Clearer Tax Rules on Digital Income', 'A coalition of creators asks for simplified quarterly reporting.', 'Current rules, they argue, treat platform payouts inconsistently and leave many unsure what they owe.', 'photo-1534430071631-854ff55eec78'),
    story('Bank Hapoalim Opens a New Innovation Center in Beersheba', 'The center will focus on fintech and artificial intelligence.', 'As part of the project, students from the local university will join hands-on projects with the bank\'s teams.', 'photo-1559526324-593bc073d938'),
    story('Port Automation Cuts Container Wait Times by a Third', 'Operators credit new scheduling software and remote cranes.', 'Shipping lines say the change is already lowering costs for importers of food and electronics.', 'photo-1590496793907-4d66e2994b4d'),
    story('Securities Authority Tightens Oversight of Mutual Funds', 'New rules will require full disclosure of management fees.', 'The regulator said the move is meant to let savers compare funds more easily.', 'photo-1560221328-12fe60f83ab8'),
  ],
  technology: [
    story('New Open-Source Browser Engine Passes Major Compatibility Milestone', 'Developers say it now renders most popular sites correctly.', 'The project, run by a small volunteer team, has gained sponsorship from two large hardware makers.', 'photo-1542831371-29b0f74f9713'),
    story('New Study: AI Helps Detect Eye Diseases Early', 'The algorithm spotted early warning signs with 94 percent accuracy.', 'Researchers tested the system on thousands of retinal images from hospitals in four countries.', 'photo-1576210117723-cd06449a467d'),
    story('Why Your Phone Battery Degrades and How to Slow It Down', 'Engineers explain the chemistry behind capacity loss.', 'Heat and full charge cycles do the most damage, and simple habits can extend a battery\'s useful life by a year or more.', 'photo-1536692192939-f1547f1cde39'),
    story('Tech Giant Launches a New Energy-Saving Chip', 'The chip is designed for laptops and promises a full workday on a single charge.', 'According to the company, performance improves by about 30 percent while power consumption drops.', 'photo-1494083306499-e22e4a457632'),
    story('Cities Trial Smart Streetlights That Dim When Roads Are Empty', 'Pilot in three districts cut electricity use by 40 percent.', 'Sensors adjust brightness based on foot and car traffic, and residents can report faults through a simple app.', 'photo-1566276423184-a8c13d2a88a1'),
    story('Guide: How to Protect Your Accounts With Two-Factor Authentication', 'Security experts explain why a strong password is no longer enough.', 'Turning on two-factor authentication takes less than five minutes and prevents most break-ins into personal accounts.', 'photo-1614064641938-3bbee52942c7'),
    story('Quantum Networking Experiment Links Two Labs Across a City', 'Researchers transmitted entangled photons over 30 kilometers of fiber.', 'The team says a practical, unhackable communication line is still years away, but the result removes a key obstacle.', 'photo-1594915440248-1e419eba6611'),
    story('New Public Transport App Shows Real-Time Arrival Times', 'The app is based on GPS data from the buses.', 'The developers promise accuracy to within about a minute and a half and plan to add alerts about delays.', 'photo-1730276649744-a2092d18cce0'),
    story('Developers Weigh In on the Rise of Local-First Software', 'Apps that work offline and sync later are gaining ground.', 'Proponents say the model improves privacy and speed, while critics point to the complexity of resolving conflicts.', 'photo-1607799279861-4dd421887fb3'),
    story('Government Launches a Program to Boost Tech Training in Outlying Regions', 'The program includes scholarships and learning centers in the north and south.', 'The goal is to double the number of graduates in high-tech professions within five years.', 'photo-1723987135977-ae935608939e'),
  ],
  science: [
    story('Astronomers Detect Unusual Radio Signal From a Nearby Galaxy', 'The repeating burst has puzzled several observatories.', 'Follow-up observations are planned for next month, and researchers stress that a natural explanation remains the most likely.', 'photo-1662614380507-72f8d36f1d2b'),
    story('Technion Researchers Develop a Material That Breaks Down Plastic at Low Temperatures', 'The material is based on an enzyme created in the lab.', 'According to the team, the technology could significantly reduce the amount of plastic waste in the sea.', 'photo-1511174511562-5f7f18b874f8'),
    story('Deep-Sea Expedition Finds Dozens of Previously Unknown Species', 'Scientists mapped a hydrothermal field at 3,000 meters.', 'Among the discoveries are translucent worms and a shrimp that appears to glow in response to touch.', 'photo-1495012379376-194a416fcc5f'),
    story('The Moon Is Drifting Away From Earth: What Does It Mean for Us?', 'Scientists explain the phenomenon and its effect on the tides.', 'The moon moves away by about 3.8 centimeters a year, a change far too slow to affect our lives in the foreseeable future.', 'photo-1522030299830-16b8d3d049fe'),
    story('New Vaccine Platform Shows Promise in Early Human Trials', 'Volunteers developed strong immune responses with mild side effects.', 'If later phases confirm the results, the platform could allow faster updates against fast-mutating viruses.', 'photo-1623682687826-fe06bf64e6d8'),
    story('Archaeological Find: 2,000-Year-Old Coins Discovered in the Galilee', 'The coins were uncovered during a salvage excavation before a road was paved.', 'Israel Antiquities Authority researchers believe the coins date from the period of the Great Revolt.', 'photo-1718140245037-8d02a29e425e'),
    story('Climate Models Improve With Better Cloud Data', 'A satellite mission is closing one of science\'s biggest uncertainties.', 'Clouds both cool and warm the planet, and capturing their behavior has long been the hardest part of forecasting.', 'photo-1517685352821-92cf88aee5a5'),
    story('Research Submarine Returns From an Arctic Ocean Expedition', 'The crew collected samples of ice thousands of years old.', 'The samples will help reconstruct past climate conditions and predict future changes.', 'photo-1567618890770-5fba551e55fb'),
    story('How Bees Navigate: Study Reveals the Role of the Sun\'s Polarization', 'Experiments show insects adjust routes on cloudy days.', 'The findings could inspire navigation systems for small robots that cannot rely on satellite signals.', 'photo-1600752384899-7d3dcbb2428c'),
    story('Study: Enough Sleep Improves Long-Term Memory', 'Participants who slept eight hours remembered over 30 percent more of the material.', 'The researchers explain that during sleep the brain organizes and strengthens memories acquired during the day.', 'photo-1531353826977-0941b4779a1c'),
  ],
  health: [
    story('Hospitals Report Early Start to the Flu Season', 'Emergency departments urge high-risk groups to get vaccinated now.', 'Doctors say children and adults over 65 are most affected, and that vaccination remains the best protection.', 'photo-1758404958502-44f156617bae'),
    story('Health Ministry Expands Early Colon Cancer Screening Program', 'The test will be offered free to everyone over 50.', 'The program will be rolled out gradually across all health funds over the coming year.', 'photo-1631217868264-e5b90bb7e133'),
    story('Study Links Daily Walking to Lower Risk of Heart Disease', 'Even 20 minutes a day made a measurable difference.', 'Researchers followed 30,000 adults for a decade and found the benefit held regardless of age or starting fitness.', 'photo-1691605085147-646fd8059b6d'),
    story('Experts: How to Cope With Summer Heat', 'Simple guidelines to prevent dehydration in children and older adults.', 'Doctors recommend drinking water even when you are not thirsty, staying out of the sun between 10:00 and 16:00, and wearing light clothing.', 'photo-1529079337819-f6d0024bd364'),
    story('Mental Health Apps: Helpful Tool or Poor Substitute?', 'Clinicians say they can support therapy but not replace it.', 'Reviewers note that the best-rated apps focus on tracking mood and teaching coping skills rather than offering diagnoses.', 'photo-1604480132736-44c188fe4d20'),
    story('Haifa Hospital Opens a New Sports Medicine Department', 'The department will serve professional and amateur athletes alike.', 'The team includes orthopedists, physiotherapists and nutritionists who will work together with every patient.', 'photo-1649751361457-01d3a696c7e6'),
    story('New Guidelines Recommend Later Screening for Some Cancers', 'Panel says benefits and risks vary by age and family history.', 'Doctors stress that patients should discuss their personal risk before deciding when to begin testing.', 'photo-1505751172876-fa1923c5c528'),
    story('Mediterranean Diet Shines Again in a Long-Term Study', 'Participants who followed the diet had less diabetes and inflammation.', 'The researchers stress that drastic changes are not needed, just a steady addition of vegetables, legumes and olive oil.', 'photo-1653611540493-b3a896319fbf'),
    story('Rural Clinics Get Telemedicine Upgrades', 'Patients can now consult specialists without traveling hours.', 'A pilot in three villages cut missed appointments by half and reduced the load on regional hospitals.', 'photo-1758691462743-f9fc9e430d39'),
    story('Parents Urged to Make Sure Their Children Are Vaccinated Against Measles', 'The number of cases has risen in recent weeks.', 'According to the Health Ministry, most of those infected did not receive the second dose of the vaccine.', 'photo-1576766125535-b04e15fd0273'),
  ],
  sports: [
    story('Underdogs Stun the Champions in Overtime Thriller', 'A last-second three-pointer sealed the upset.', 'The home crowd erupted as the shot dropped, ending the visitors\' 18-game winning streak.', 'photo-1583079806406-91731880e785'),
    story('Maccabi Tel Aviv Wins the Derby and Closes In on the Top', 'A late goal from the captain decided the match in a packed stadium.', 'The win brings the team within three points of first place in the league table.', 'photo-1629217855633-79a6925d6c47'),
    story('Marathon Record Falls on a Cool, Windless Morning', 'The winner shaved 40 seconds off the previous best.', 'Race organizers credit new pacing lights and a flatter course for the fastest field in the event\'s history.', 'photo-1590333748338-d629e4564ad9'),
    story('Youth National Team Reaches the European Championship Final', 'The team beat its rival in a dramatic penalty shootout.', 'The coach thanked the players and the crowd that packed the stands.', 'photo-1517927033932-b3d18e61fb3a'),
    story('Young Sprinter Breaks National Under-20 Record', 'Her 11.2-second time turned heads at the national trials.', 'Coaches say her start technique has improved dramatically since the winter camp.', 'photo-1526676317768-d9b14f15615a'),
    story('Hapoel Jerusalem Signs a New Point Guard From the United States', 'The 26-year-old averaged 17 points a game last season.', 'The club hopes the signing will strengthen its offense ahead of the EuroCup games.', 'photo-1585071258252-369a36d89e30'),
    story('Why Cycling Is Booming in City Centers', 'New protected lanes are drawing commuters and weekend riders alike.', 'Municipal data shows daily bike trips doubled in two years, along with a drop in short car journeys.', 'photo-1656924447185-7b15c8a89185'),
    story('World Judo Champion Returns to Training After Injury', 'The judoka plans to compete in the upcoming championship.', 'She says the recovery was long, but she feels stronger than ever.', 'photo-1656653121475-e33829581294'),
    story('Tennis Federation Announces Grassroots Court Program', 'Free coaching will be offered in twenty municipalities.', 'Officials hope to widen the pool of players and find talent in areas with few sports facilities.', 'photo-1545151414-8a948e1ea54f'),
    story('Women\'s Basketball Team Wins the Series and Reaches the Final', 'The series was decided in a tense game five on home court.', 'The crowd, which filled the arena to capacity, stayed to celebrate with the players long after the final buzzer.', 'photo-1744725845508-054bf3b6d80c'),
  ],
  entertainment: [
    story('Festival Opens With a Surprise Screening of a Restored Classic', 'Audiences lined up around the block for the midnight showing.', 'Restoration teams spent two years repairing the original negatives and remastering the soundtrack.', 'photo-1485095329183-d0797cdc5676'),
    story('New Drama Series Breaks Viewing Records on the Platform', 'The first episode was watched by more than a million subscribers over the weekend.', 'Critics are praising the acting and the script, and are looking forward to a second season.', 'photo-1692188071339-2825a8a997f1'),
    story('Indie Band Sells Out a Three-Night Run in Tel Aviv', 'Fans traveled from across the country for the hometown shows.', 'The group says the tour, planned as a small experiment, has convinced them to record a live album.', 'photo-1565035010268-a3816f98589a'),
    story('New Play at Habima Theatre Grapples With Questions of Identity', 'Audiences and critics call it one of the standout productions of the season.', 'The director says the play was inspired by the true stories of immigrant families.', 'photo-1615414046707-3d7d91938aa4'),
    story('Streaming Services Bet on Shorter Seasons', 'Producers say eight episodes are easier to fund and to binge.', 'Viewers, however, are split on whether shorter runs leave stories under-developed.', 'photo-1593359677879-a4bb92f829d1'),
    story('Young Singer\'s Debut Album Wins Critical Praise', 'The album blends Mediterranean music with electronic sounds.', 'The songs were written in three languages, and the singer is planning a summer tour.', 'photo-1520872024865-3ff2805d8bb3'),
    story('Comic Convention Draws Record Crowd of Costumed Fans', 'Organizers had to open a second hall on the first day.', 'Panels with local artists were among the most crowded events of the weekend.', 'photo-1573658070990-e4c084b95cc5'),
    story('Israeli Film Wins the Top Prize at a London Festival', 'The film follows a father and daughter reconnecting after years apart.', 'The director thanked the production team and dedicated the award to his family.', 'photo-1741887864007-271499b10d53'),
    story('Museum Night Returns With Free Late-Hour Access', 'More than forty venues will keep their doors open until midnight.', 'The program includes live music, guided tours and hands-on workshops for children.', 'photo-1637578035851-c5b169722de1'),
    story('New Reality Show Gets Mixed Reviews', 'Viewers are divided over its surprising format.', 'While some praise its freshness, others argue that the show relies too heavily on manufactured drama.', 'photo-1671575584088-03eb2811c30f'),
  ],
  world: [
    story('Regional Leaders Agree on a Joint Plan for Flood Recovery', 'The plan pools funds for rebuilding bridges and clinics.', 'Delegates say cooperation is essential because the rivers cross three national borders.', 'photo-1604275689235-fdc521556c16'),
    story('Mass Protests in a European Capital Over Rising Energy Prices', 'Tens of thousands marched through the city, calling on the government to act.', 'Organizers said the protest was peaceful and passed without unusual incidents.', 'photo-1511898634545-c01af8a54dd5'),
    story('Global Food Prices Ease for the Fourth Straight Month', 'The UN agency credits improved harvests and cheaper shipping.', 'Analysts caution that prices for cooking oil and rice remain above pre-crisis levels.', 'photo-1635174815612-fd9636f70146'),
    story('International Climate Summit Opens With Funding Pledges', 'Wealthy countries announced billions in support for developing nations.', 'Environmental groups have reservations, arguing that the sums fall short of what is needed.', 'photo-1679589164488-ca6dc6746af9'),
    story('Volcanic Eruption Disrupts Air Travel Across the Pacific', 'Airlines reroute dozens of flights as ash rises to 10 kilometers.', 'Authorities have evacuated nearby villages and say no casualties have been reported.', 'photo-1475776408506-9a5371e7a068'),
    story('South American Election: Opposition Candidate Leads in the Polls', 'Polls show a five-point lead in the first round.', 'The country\'s economy and the fight against inflation are at the center of the campaign.', 'photo-1713001075225-8c490e800e29'),
    story('Ancient Trade Route Reopens as a Hiking Trail', 'The 300-kilometer path connects mountain villages in the Balkans.', 'Local guides expect tourism to bring new income to communities that have seen years of emigration.', 'photo-1663524963924-4d84fd7204b5'),
    story('UN Calls for More Humanitarian Aid to Disaster Zones', 'Millions of people need food and clean water.', 'The organization stresses that current resources cover less than half of those in need.', 'photo-1593113616828-6f22bca04804'),
    story('Rail Link Between Two Capitals Cuts Journey to Three Hours', 'The high-speed line opened after a decade of construction.', 'Officials expect it to replace many short-haul flights and reduce emissions.', 'photo-1708053611310-80959cee39cc'),
    story('African Countries Sign a New Free Trade Agreement', 'The agreement aims to boost trade within the continent.', 'Economists expect the deal to encourage employment and growth within a decade.', 'photo-1734255026082-82fdc81991f0'),
  ],
  opinion: [
    story('We Need to Talk About the Cost of Being Always Online', 'Constant connectivity was supposed to free us. Has it?', 'The promise was flexibility, but many of us now answer messages at midnight and call it choice.', 'photo-1675510183225-76c920848c29'),
    story('Why We Should Bring Back Shorter School Days', 'Fewer hours, more quality: the case for restructuring the school day.', 'Studies from other countries show that a short, focused school day improves achievement and student well-being.', 'photo-1509062522246-3755977927d7'),
    story('City Parks Are Infrastructure, Not Luxury', 'Green space deserves a place in the budget beside roads and water.', 'A single well-kept park lowers summer temperatures, improves health and gives neighbors somewhere to meet.', 'photo-1605540827677-693bad36b91f'),
    story('Our Culture of Argument Has Become a Battlefield, and We Are Part of It', 'How can we disagree without hating each other?', 'When every conversation becomes a fight over who is right, we lose the ability to listen.', 'photo-1626447269096-f8665509589c'),
    story('In Defense of the Boring Commute', 'Sometimes the time between places is the only quiet time we get.', 'Take away the reading, the window-gazing and the podcasts, and we lose a small daily rehearsal for thinking.', 'photo-1527249014055-1b2b9d5e9fbe'),
    story('It\'s Time for Real Reform of the Rental Market', 'Young people in Israel pay more and get less.', 'Long-term leases and tenant protections are a necessary step toward social stability.', 'photo-1741156386380-0236c72eb6f9'),
    story('Local News Deserves Local Support', 'When community papers disappear, accountability disappears with them.', 'Readers who value scrutiny of city hall should consider paying for it, just as they pay for other public goods.', 'photo-1495020689067-958852a7765e'),
    story('Why It Matters to Teach Coding at a Young Age', 'Not every child will become a programmer, but all of them will live in a world of code.', 'Understanding how systems work strengthens critical thinking and problem-solving skills.', 'photo-1597933471507-1ca5765185d8'),
    story('The Case for a Four-Day Work Week Is Stronger Than You Think', 'Pilot programs show maintained output and happier employees.', 'The strongest objections turn out to be about management habits rather than economics.', 'photo-1435527173128-983b87201f4d'),
    story('Never Underestimate the Power of Good Neighbors', 'A strong local community is the best answer to urban loneliness.', 'A short chat in the building\'s courtyard can change how a neighborhood feels more than any government program.', 'photo-1626387753307-5a329fa44578'),
  ],
  culture: [
    story('Old City Bookshop Celebrates a Century of Trade', 'Generations of readers have browsed its crowded shelves.', 'The owner\'s grandchildren now run the shop and have added a small reading room and a weekly poetry night.', 'photo-1528700850553-6a45e6f143db'),
    story('New Exhibition at the Tel Aviv Museum Reveals Works Never Shown Before', 'The curators selected more than a hundred works from private collections.', 'The exhibition opens next week and will run until the end of the winter.', 'photo-1569783721854-33a99b4c0bae'),
    story('Traditional Weavers Find a New Audience Online', 'Village cooperatives now sell rugs to buyers on three continents.', 'Younger members handle photography and shipping, while elders keep alive patterns that date back generations.', 'photo-1569909115134-a0426936c879'),
    story('International Literature Festival Celebrates a Decade With Guests From Around the World', 'Writers will discuss translation, memory and the future of the book.', 'Alongside the talks, there will be writing workshops and reading evenings in cafés across the city.', 'photo-1495446815901-a7297e633e8d'),
    story('A Walking Tour of the City\'s Hidden Murals', 'Street artists have turned back alleys into open-air galleries.', 'The route takes about two hours and ends at a courtyard where the oldest of the works still stands.', 'photo-1530406831759-15c5c0cbce8b'),
    story('Israeli Ballet\'s Premiere Receives a Standing Ovation', 'The piece combines classical music with contemporary dance.', 'The audience rose to its feet at the end, and the choreographer thanked her dancers in tears.', 'photo-1508807526345-15e9b5f4eaff'),
    story('Language Revival Project Records the Last Fluent Speakers', 'Linguists race to document stories and songs before they are lost.', 'Recordings will be made available to schools so that young people can learn from the voices of elders.', 'photo-1478737270239-2f02b77fc618'),
    story('Family Cooking Traditions Return to Restaurants', 'Young chefs are reviving recipes passed down from generation to generation.', 'Nostalgia, they explain, is no less important an ingredient than taste.', 'photo-1622021142947-da7dedc7c39a'),
    story('Library Turns Unused Floor Into a Community Maker Space', 'Free workshops in sewing, woodworking and electronics start this month.', 'Librarians say the space has been booked solid since registration opened.', 'photo-1766096847418-9a2ae64c9621'),
    story('Israel Museum\'s Season-Opening Concert Ends on an Emotional Note', 'The musicians performed works by young Israeli composers.', 'The orchestra announced another concert series that will take place in public parks.', 'photo-1519682718457-c82ce8296645'),
  ],
};

/** Shared middle paragraphs, per language, appended to a story's lead to form the body. */
export const FILLER = {
  en: [
    'Sources close to the matter said the development had been expected for several weeks, though few anticipated the speed with which it unfolded.',
    'Experts interviewed for this report agreed that the long-term effects will depend on how quickly institutions adapt and how the public responds.',
    'Residents in the affected areas described a mix of relief and caution, noting that earlier promises had not always been kept.',
    'An official statement is expected later this week, and the newsroom will update this story as more details become available.',
    'Critics argue that the approach leaves important questions unanswered, while supporters say it is a reasonable first step.',
    'Data reviewed by our reporters suggests the trend has been building for months, even if it only recently reached the headlines.',
  ],
  he: [
    'גורמים המעורים בפרטים מסרו כי ההתפתחות צפויה כבר כמה שבועות, אם כי מעטים ציפו לקצב שבו התרחשו הדברים.',
    'מומחים שרואיינו לכתבה הסכימו כי ההשפעה ארוכת הטווח תלויה במהירות ההתאמה של המוסדות ובתגובת הציבור.',
    'תושבי האזור תיארו תערובת של הקלה וזהירות, ואמרו כי הבטחות קודמות לא תמיד קוימו.',
    'הודעה רשמית צפויה בהמשך השבוע, והמערכת תעדכן את הכתבה ככל שיתבררו פרטים נוספים.',
    'מבקרים טוענים כי הגישה משאירה שאלות חשובות ללא מענה, ואילו תומכים רואים בה צעד ראשון סביר.',
    'נתונים שנבדקו על ידי כתבינו מלמדים כי המגמה נבנתה במשך חודשים, גם אם רק לאחרונה הגיעה לכותרות.',
  ],
};

/** One-paragraph additions an editor approves as "updates" to a live story. */
export const UPDATES = {
  en: [
    'Update: officials confirmed new figures this afternoon, and the numbers above have been revised accordingly.',
    'Update: a spokesperson responded to the criticism and said the plan will be reviewed within thirty days.',
    'Update: reaction has continued to arrive from readers and stakeholders; a selection is added below.',
    'Update: a correction was made to an earlier version of this report, and an additional source has been quoted.',
  ],
  he: [
    'עדכון: גורמים רשמיים אישרו הבוקר נתונים חדשים, והמספרים שבכתבה עודכנו בהתאם.',
    'עדכון: דובר הגיב לביקורת ומסר כי התוכנית תיבחן מחדש בתוך שלושים יום.',
    'עדכון: תגובות נוספות מהקוראים ומהמעורבים הגיעו למערכת, ומבחר מהן נוסף בהמשך.',
    'עדכון: תוקנה טעות בגרסה קודמת של הכתבה, והוספה התייחסות של גורם נוסף.',
  ],
};

/** A reporter's not-yet-submitted addition (working copy ahead of the published one). */
export const DRAFT_ADDITIONS = {
  en: 'Draft addition: adding a fresh quote and a paragraph of background context before resubmitting.',
  he: 'תוספת בטיוטה: מוסיף ציטוט חדש ופסקת רקע לפני שליחה מחדש לאישור.',
};

export const EDITOR_NOTES = {
  en: [
    'Please add a second source for the central claim.',
    'The headline overstates the facts; tighten it and resubmit.',
    'Check the figures in the third paragraph against the official release.',
  ],
  he: [
    'נא להוסיף מקור שני לטענה המרכזית.',
    'הכותרת מגזימה ביחס לעובדות, יש לתקן ולהגיש מחדש.',
    'יש לבדוק את המספרים בפסקה השלישית מול ההודעה הרשמית.',
  ],
};

export const GUEST_NAMES = ['Noa', 'Daniel', 'Maya', 'Tom', 'Shira', 'Yossi', 'Lior', 'Hannah', 'Omer', 'Sam'];
export const GUEST_COMMENTS = {
  en: [
    'Great reporting, thanks for the detail.',
    'I wish there were more context on how this was decided.',
    'This matches what I have seen in my own neighborhood.',
    'Interesting, but I would like to see the full data.',
  ],
  he: [
    'כתבה מצוינת, תודה על הפירוט.',
    'הייתי שמח לקבל יותר הקשר לגבי ההחלטה.',
    'זה תואם את מה שאני רואה בשכונה שלי.',
    'מעניין, אבל הייתי רוצה לראות את הנתונים המלאים.',
  ],
};
