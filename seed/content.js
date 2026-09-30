/**
 * Curated demo content for the seed. Fictional, plausible newsroom copy in
 * Hebrew (he) and English (en), ten stories per category in `CATEGORIES`.
 * Each story: { lang, title, abstract, lead }.
 */
const en = (title, abstract, lead) => ({ lang: 'en', title, abstract, lead });
const he = (title, abstract, lead) => ({ lang: 'he', title, abstract, lead });

export const STORIES = {
  politics: [
    en('Coalition Talks Stall Over Budget Priorities', 'Negotiators trade proposals as the deadline for the state budget approaches.', "Party leaders met late into the night but left without a deal on how to split next year's spending between defense, housing and transport."),
    he('ועדת הכספים אישרה את תקציב התחבורה הציבורית', 'התקציב החדש יאפשר הרחבת קווי לילה בערים הגדולות.', 'חברי הוועדה אישרו בהצבעה את ההגדלה בתקציב, לאחר דיון שנמשך שעות ארוכות ובו נשמעו הסתייגויות מצד האופוזיציה.'),
    en('Local Elections: Turnout Expected to Hit a Decade High', 'Polling stations report early queues in several major cities.', 'Election officials say advance registration and a new mobile reminder service have lifted participation well above previous cycles.'),
    he('הכנסת אישרה בקריאה שנייה את חוק השקיפות', 'החוק יחייב פרסום תרומות לגופים ציבוריים בתוך שבעה ימים.', 'הצעת החוק עברה ברוב של 61 חברי כנסת, והיא צפויה לעלות לקריאה שלישית בשבוע הבא.'),
    en('Mayors Call for Direct Funding of School Meals', 'A joint letter asks the government to bypass regional councils.', 'Twelve mayors argue that the current allocation model delays payments and leaves the poorest neighborhoods waiting for weeks.'),
    he('ראש הממשלה נפגש עם מנהיגי האיחוד האירופי', 'הפגישה עסקה בשיתוף פעולה כלכלי ובאנרגיה מתחדשת.', 'לפי הודעה רשמית, הצדדים סיכמו להקים צוות משותף שיגיש המלצות בתוך שישה חודשים.'),
    en('Civil Service Reform Draws Sharp Union Response', 'Unions warn of strikes if hiring rules change without consultation.', 'The proposal would shorten tenders and let ministries hire for temporary projects without a full public competition.'),
    he('מבקר המדינה: ליקויים בניהול פרויקטי תשתית', 'הדוח מצביע על חריגות תקציב חוזרות בעבודות כבישים.', 'לפי הדוח, ארבעה מתוך חמישה פרויקטים שנבדקו הסתיימו באיחור ממוצע של שמונה חודשים.'),
    en('Parliament Debates Voting Age for Local Elections', 'A bipartisan bill proposes lowering the age to sixteen.', 'Supporters say early participation builds lifelong civic habits; critics question whether teenagers have enough independence from family pressure.'),
    he('מפלגות האופוזיציה הגישו הצעת אי־אמון', 'ההצבעה צפויה להתקיים בתחילת השבוע הבא.', 'ראשי האופוזיציה טוענים כי הממשלה איבדה את הרוב הפרלמנטרי בנושאי הליבה, אך בקואליציה מעריכים שההצעה תיפול.'),
  ],
  business: [
    en('Central Bank Holds Rates Steady for Third Meeting', 'Governor cites cooling inflation but warns of housing pressure.', 'Markets had priced in the decision, and the shekel barely moved after the announcement.'),
    he('סטארט־אפ ישראלי גייס 80 מיליון דולר בסבב C', 'החברה מפתחת פתרונות אבטחת סייבר לענן.', 'הכסף ישמש להרחבת הפעילות בארה"ב ולגיוס כ־150 עובדים חדשים בשנה הקרובה.'),
    en('Small Businesses Struggle With Rising Commercial Rents', 'Shop owners in city centers report double-digit increases.', 'A survey of 400 retailers found that one in five is considering relocation or closure within the year.'),
    he('שוק הדיור: מחירי הדירות נחלשו לראשונה מזה שנה', 'הירידה מרוכזת בעיקר בדירות חדשות בפריפריה.', 'לפי נתוני הלמ"ס, מחיר הדירה הממוצע ירד בכחצי אחוז בחודשיים האחרונים.'),
    en('Retail Giant Unveils Plan to Halve Packaging Waste', 'New targets cover own-brand products by 2028.', 'The company says it will move to refillable containers in its grocery lines and cut plastic film use across all warehouses.'),
    he('חברות התעופה מגדילות את מספר הטיסות לקיץ', 'הביקוש לטיסות לאירופה שובר שיאים.', 'נמל התעופה צופה כי מספר הנוסעים בחודשי הקיץ יעלה בכ־12 אחוזים לעומת אשתקד.'),
    en('Freelancers Push for Clearer Tax Rules on Digital Income', 'A coalition of creators asks for simplified quarterly reporting.', 'Current rules, they argue, treat platform payouts inconsistently and leave many unsure what they owe.'),
    he('בנק הפועלים הכריז על פתיחת מרכז חדשנות בבאר שבע', 'המרכז יעסוק בפינטק ובבינה מלאכותית.', 'במסגרת הפרויקט ישולבו סטודנטים מהאוניברסיטה בפרויקטים מעשיים עם צוותי הבנק.'),
    en('Port Automation Cuts Container Wait Times by a Third', 'Operators credit new scheduling software and remote cranes.', 'Shipping lines say the change is already lowering costs for importers of food and electronics.'),
    he('הרשות לניירות ערך מחמירה את הפיקוח על קרנות נאמנות', 'הכללים החדשים ידרשו גילוי מלא של דמי ניהול.', 'הרגולטור מסר כי המהלך נועד לאפשר לחוסכים להשוות בין קרנות בצורה פשוטה.'),
  ],
  technology: [
    en('New Open-Source Browser Engine Passes Major Compatibility Milestone', 'Developers say it now renders most popular sites correctly.', 'The project, run by a small volunteer team, has gained sponsorship from two large hardware makers.'),
    he('מחקר חדש: בינה מלאכותית מסייעת באבחון מוקדם של מחלות עיניים', 'האלגוריתם זיהה סימנים מוקדמים בדיוק של 94 אחוזים.', 'החוקרים בדקו את המערכת על אלפי תצלומי רשתית מבתי חולים בארבע מדינות.'),
    en('Why Your Phone Battery Degrades and How to Slow It Down', 'Engineers explain the chemistry behind capacity loss.', "Heat and full charge cycles do the most damage, and simple habits can extend a battery's useful life by a year or more."),
    he('חברת ענק משיקה שבב חדש לחיסכון באנרגיה', 'השבב מיועד למחשבים ניידים ומבטיח יום עבודה שלם על טעינה אחת.', 'לדברי החברה, הביצועים משתפרים בכ־30 אחוזים תוך צריכת חשמל נמוכה יותר.'),
    en('Cities Trial Smart Streetlights That Dim When Roads Are Empty', 'Pilot in three districts cut electricity use by 40 percent.', 'Sensors adjust brightness based on foot and car traffic, and residents can report faults through a simple app.'),
    he('מדריך: כך תגנו על החשבונות שלכם עם אימות דו־שלבי', 'מומחי אבטחה מסבירים למה סיסמה חזקה כבר לא מספיקה.', 'הפעלת אימות דו־שלבי לוקחת פחות מחמש דקות ומונעת את רוב הפריצות לחשבונות פרטיים.'),
    en('Quantum Networking Experiment Links Two Labs Across a City', 'Researchers transmitted entangled photons over 30 kilometers of fiber.', 'The team says a practical, unhackable communication line is still years away, but the result removes a key obstacle.'),
    he('אפליקציית תחבורה ציבורית חדשה מציגה זמני הגעה בזמן אמת', 'האפליקציה מבוססת על נתוני GPS מהאוטובוסים.', 'המפתחים מבטיחים דיוק של כדקה וחצי, ומתכננים להוסיף התראות על עיכובים.'),
    en('Developers Weigh In on the Rise of Local-First Software', 'Apps that work offline and sync later are gaining ground.', 'Proponents say the model improves privacy and speed, while critics point to the complexity of resolving conflicts.'),
    he('הממשלה משיקה תוכנית לחיזוק ההכשרה הטכנולוגית בפריפריה', 'התוכנית כוללת מלגות ומרכזי לימוד באזורי הצפון והדרום.', 'מטרת התוכנית להכפיל את מספר הבוגרים במקצועות ההייטק תוך חמש שנים.'),
  ],
  science: [
    en('Astronomers Detect Unusual Radio Signal From a Nearby Galaxy', 'The repeating burst has puzzled several observatories.', 'Follow-up observations are planned for next month, and researchers stress that a natural explanation remains the most likely.'),
    he('חוקרים מהטכניון פיתחו חומר שמפרק פלסטיק בטמפרטורה נמוכה', 'החומר מבוסס על אנזים שנוצר במעבדה.', 'לדברי הצוות, הטכנולוגיה יכולה להפחית משמעותית את כמות הפסולת בים.'),
    en('Deep-Sea Expedition Finds Dozens of Previously Unknown Species', 'Scientists mapped a hydrothermal field at 3,000 meters.', 'Among the discoveries are translucent worms and a shrimp that appears to glow in response to touch.'),
    he('הירח מתרחק מכדור הארץ: מה זה אומר עבורנו?', 'מדענים מסבירים את התופעה ואת השפעתה על הגאות והשפל.', 'הירח מתרחק בכ־3.8 סנטימטרים בשנה, שינוי איטי מכדי להשפיע על חיינו בטווח הנראה לעין.'),
    en('New Vaccine Platform Shows Promise in Early Human Trials', 'Volunteers developed strong immune responses with mild side effects.', 'If later phases confirm the results, the platform could allow faster updates against fast-mutating viruses.'),
    he('גילוי ארכיאולוגי: מטבעות בני 2,000 שנה נמצאו בגליל', 'המטבעות נחשפו במהלך חפירת הצלה לפני סלילת כביש.', 'חוקרי רשות העתיקות מעריכים כי המטבעות שייכים לתקופת המרד הגדול.'),
    en('Climate Models Improve With Better Cloud Data', "A satellite mission is closing one of science's biggest uncertainties.", 'Clouds both cool and warm the planet, and capturing their behavior has long been the hardest part of forecasting.'),
    he('הצוללת המחקרית חזרה מסיור באוקיינוס הארקטי', 'הצוות אסף דגימות מקרח בן אלפי שנים.', 'הדגימות יסייעו לשחזר את תנאי האקלים בעבר ולחזות שינויים עתידיים.'),
    en("How Bees Navigate: Study Reveals the Role of the Sun's Polarization", 'Experiments show insects adjust routes on cloudy days.', 'The findings could inspire navigation systems for small robots that cannot rely on satellite signals.'),
    he('מחקר: שינה מספקת משפרת את הזיכרון לטווח ארוך', 'משתתפים שישנו שמונה שעות זכרו יותר מ־30 אחוזים מהחומר.', 'החוקרים מסבירים כי במהלך השינה המוח מארגן ומחזק זיכרונות שנרכשו ביום.'),
  ],
  health: [
    en('Hospitals Report Early Start to the Flu Season', 'Emergency departments urge high-risk groups to get vaccinated now.', 'Doctors say children and adults over 65 are most affected, and that vaccination remains the best protection.'),
    he('משרד הבריאות מרחיב את תוכנית הבדיקות המוקדמות לסרטן המעי', 'הבדיקה תוצע חינם לכל מי שמעל גיל 50.', 'התוכנית תיושם בהדרגה בכל קופות החולים במהלך השנה הקרובה.'),
    en('Study Links Daily Walking to Lower Risk of Heart Disease', 'Even 20 minutes a day made a measurable difference.', 'Researchers followed 30,000 adults for a decade and found the benefit held regardless of age or starting fitness.'),
    he('מומחים: כך תתמודדו עם עומס חום בקיץ', 'הנחיות פשוטות למניעת התייבשות בקרב ילדים וקשישים.', 'הרופאים ממליצים לשתות מים גם בלי תחושת צמא, להימנע משהות בשמש בין 10:00 ל־16:00 ולהתלבש בבגדים קלים.'),
    en('Mental Health Apps: Helpful Tool or Poor Substitute?', 'Clinicians say they can support therapy but not replace it.', 'Reviewers note that the best-rated apps focus on tracking mood and teaching coping skills rather than offering diagnoses.'),
    he('בית חולים בחיפה השיק מחלקה חדשה לרפואת ספורט', 'המחלקה תשרת ספורטאים מקצועיים וחובבים כאחד.', 'הצוות כולל אורתופדים, פיזיותרפיסטים ותזונאים שיעבדו יחד עם כל מטופל.'),
    en('New Guidelines Recommend Later Screening for Some Cancers', 'Panel says benefits and risks vary by age and family history.', 'Doctors stress that patients should discuss their personal risk before deciding when to begin testing.'),
    he('תזונה ים־תיכונית מצטיינת שוב במחקר ארוך טווח', 'הנוטלים חלק בדיאטה סבלו פחות מסוכרת ומדלקות.', 'החוקרים מדגישים כי לא נדרשים שינויים דרסטיים, אלא תוספת עקבית של ירקות, קטניות ושמן זית.'),
    en('Rural Clinics Get Telemedicine Upgrades', 'Patients can now consult specialists without traveling hours.', 'A pilot in three villages cut missed appointments by half and reduced the load on regional hospitals.'),
    he('הורים מתבקשים לוודא שילדיהם חוסנו נגד חצבת', 'בשבועות האחרונים נרשמה עלייה במספר החולים.', 'לפי משרד הבריאות, רוב החולים לא קיבלו את המנה השנייה של החיסון.'),
  ],
  sports: [
    en('Underdogs Stun the Champions in Overtime Thriller', 'A last-second three-pointer sealed the upset.', "The home crowd erupted as the shot dropped, ending the visitors' 18-game winning streak."),
    he('מכבי תל אביב ניצחה בדרבי וקרובה לפסגה', 'שער מאוחר של הקפטן הכריע את המשחק באצטדיון הומה.', 'הניצחון מקרב את הקבוצה לשלוש נקודות בלבד מהמקום הראשון בטבלה.'),
    en('Marathon Record Falls on a Cool, Windless Morning', 'The winner shaved 40 seconds off the previous best.', "Race organizers credit new pacing lights and a flatter course for the fastest field in the event's history."),
    he('נבחרת הנוער העפילה לגמר אליפות אירופה', 'הנבחרת ניצחה את יריבתה בהתמודדות דרמטית בדו־קרב פנדלים.', 'המאמן הודה לשחקנים ולקהל שהגיע בהמוניו ליציעים.'),
    en('Young Sprinter Breaks National Under-20 Record', 'Her 11.2-second time turned heads at the national trials.', 'Coaches say her start technique has improved dramatically since the winter camp.'),
    he('הפועל ירושלים חתמה על רכז חדש מארצות הברית', 'השחקן בן ה־26 ממוצע 17 נקודות למשחק בליגה הקודמת.', 'המועדון מקווה כי החתמה תחזק את ההתקפה לקראת משחקי היורוקאפ.'),
    en('Why Cycling Is Booming in City Centers', 'New protected lanes are drawing commuters and weekend riders alike.', 'Municipal data shows daily bike trips doubled in two years, along with a drop in short car journeys.'),
    he("אלופת העולם בג'ודו חוזרת לאימונים לאחר פציעה", "הג'ודוקאית מתכוונת להשתתף באליפות הקרובה.", 'לדבריה, ההחלמה הייתה ארוכה אך היא מרגישה חזקה מתמיד.'),
    en('Tennis Federation Announces Grassroots Court Program', 'Free coaching will be offered in twenty municipalities.', 'Officials hope to widen the pool of players and find talent in areas with few sports facilities.'),
    he('קבוצת הנשים בכדורסל ניצחה בסדרה ועלתה לגמר', 'הסדרה הוכרעה במשחק חמישי מותח באולם הבית.', 'הקהל, שמילא את האולם עד אפס מקום, נשאר לחגוג עם השחקניות זמן רב לאחר הצפירה.'),
  ],
  entertainment: [
    en('Festival Opens With a Surprise Screening of a Restored Classic', 'Audiences lined up around the block for the midnight showing.', 'Restoration teams spent two years repairing the original negatives and remastering the soundtrack.'),
    he('סדרת הדרמה החדשה שברה שיאי צפייה בפלטפורמה', 'הפרק הראשון נצפה בידי יותר ממיליון מנויים בסוף השבוע.', 'המבקרים משבחים את המשחק ואת התסריט, ומצפים לעונה שנייה.'),
    en('Indie Band Sells Out a Three-Night Run in Tel Aviv', 'Fans traveled from across the country for the hometown shows.', 'The group says the tour, planned as a small experiment, has convinced them to record a live album.'),
    he('הצגה חדשה בתיאטרון הבימה מתמודדת עם שאלות של זהות', 'הקהל והמבקרים מדברים על ההצגה כאחת הבולטות העונה.', 'הבמאית מספרת כי ההצגה נכתבה בהשראת סיפורים אמיתיים של משפחות מהגרים.'),
    en('Streaming Services Bet on Shorter Seasons', 'Producers say eight episodes are easier to fund and to binge.', 'Viewers, however, are split on whether shorter runs leave stories under-developed.'),
    he('הזמרת הצעירה השיקה אלבום בכורה לשבחי המבקרים', 'האלבום משלב מוזיקה ים־תיכונית עם אלקטרוניקה.', 'שירי האלבום נכתבו בשלוש שפות, והזמרת מתכננת סיבוב הופעות בקיץ.'),
    en('Comic Convention Draws Record Crowd of Costumed Fans', 'Organizers had to open a second hall on the first day.', 'Panels with local artists were among the most crowded events of the weekend.'),
    he('הסרט הישראלי זכה בפרס הגדול בפסטיבל בלונדון', 'הסרט עוסק ביחסים בין אב לבתו לאחר שנים של ניתוק.', 'הבמאי הודה לצוות ההפקה והקדיש את הפרס למשפחתו.'),
    en('Museum Night Returns With Free Late-Hour Access', 'More than forty venues will keep their doors open until midnight.', 'The program includes live music, guided tours and hands-on workshops for children.'),
    he('תוכנית הריאליטי החדשה זוכה לביקורות מעורבות', 'הצופים חלוקים לגבי הפורמט המפתיע.', 'בעוד שחלק משבחים את הרעננות, אחרים טוענים שהתוכנית מסתמכת יותר מדי על דרמות מלאכותיות.'),
  ],
  world: [
    en('Regional Leaders Agree on a Joint Plan for Flood Recovery', 'The plan pools funds for rebuilding bridges and clinics.', 'Delegates say cooperation is essential because the rivers cross three national borders.'),
    he('הפגנות המוניות בבירה האירופית נגד העלאת מחירי האנרגיה', 'עשרות אלפים צעדו בעיר וקראו לממשלה לפעול.', 'המארגנים מסרו כי ההפגנה הייתה שלווה ועברה ללא אירועים חריגים.'),
    en('Global Food Prices Ease for the Fourth Straight Month', 'The UN agency credits improved harvests and cheaper shipping.', 'Analysts caution that prices for cooking oil and rice remain above pre-crisis levels.'),
    he('הפסגה הבינלאומית לאקלים נפתחה בהבטחות למימון', 'מדינות עשירות הכריזו על הקצאת מיליארדים למדינות מתפתחות.', 'ארגוני סביבה מסתייגים וטוענים כי הסכומים נמוכים מהנדרש.'),
    en('Volcanic Eruption Disrupts Air Travel Across the Pacific', 'Airlines reroute dozens of flights as ash rises to 10 kilometers.', 'Authorities have evacuated nearby villages and say no casualties have been reported.'),
    he('בחירות בדרום אמריקה: המועמד האופוזיציוני מוביל בסקרים', 'הסקרים מראים יתרון של חמש נקודות בסבב הראשון.', 'כלכלת המדינה והמאבק באינפלציה עומדים במרכז מערכת הבחירות.'),
    en('Ancient Trade Route Reopens as a Hiking Trail', 'The 300-kilometer path connects mountain villages in the Balkans.', 'Local guides expect tourism to bring new income to communities that have seen years of emigration.'),
    he('האו"ם קורא להגברת הסיוע ההומניטרי לאזורי אסון', 'מיליוני אנשים זקוקים למזון ולמים נקיים.', 'הארגון מדגיש כי המשאבים הנוכחיים מספיקים רק לפחות ממחצית הנזקקים.'),
    en('Rail Link Between Two Capitals Cuts Journey to Three Hours', 'The high-speed line opened after a decade of construction.', 'Officials expect it to replace many short-haul flights and reduce emissions.'),
    he('מדינות אפריקאיות חתמו על הסכם סחר חופשי חדש', 'ההסכם נועד להגדיל את הסחר הפנים־יבשתי.', 'כלכלנים מעריכים שההסכם יעודד תעסוקה וצמיחה בתוך עשור.'),
  ],
  opinion: [
    en('We Need to Talk About the Cost of Being Always Online', 'Constant connectivity was supposed to free us. Has it?', 'The promise was flexibility, but many of us now answer messages at midnight and call it choice.'),
    he('למה כדאי להחזיר את שעות הלימוד הקצרות בבתי הספר', 'פחות שעות, יותר איכות: טענה לשינוי מבנה יום הלימודים.', 'מחקרים ממדינות אחרות מראים כי יום לימודים קצר וממוקד משפר הישגים ואת רווחת התלמידים.'),
    en('City Parks Are Infrastructure, Not Luxury', 'Green space deserves a place in the budget beside roads and water.', 'A single well-kept park lowers summer temperatures, improves health and gives neighbors somewhere to meet.'),
    he('תרבות הוויכוח הפכה לזירת קרב, ואנחנו שותפים לה', 'איך אפשר לחלוק בלי לשנוא?', 'כשכל שיחה הופכת למאבק על צדקנות, אנחנו מפסידים את היכולת להקשיב.'),
    en('In Defense of the Boring Commute', 'Sometimes the time between places is the only quiet time we get.', 'Take away the reading, the window-gazing and the podcasts, and we lose a small daily rehearsal for thinking.'),
    he('הגיע הזמן לרפורמה אמיתית בשוק השכירות', 'הצעירים בישראל משלמים יותר ומקבלים פחות.', 'חוזי שכירות ארוכי טווח והגנה על דיירים הם צעד הכרחי ליציבות חברתית.'),
    en('Local News Deserves Local Support', 'When community papers disappear, accountability disappears with them.', 'Readers who value scrutiny of city hall should consider paying for it, just as they pay for other public goods.'),
    he('מדוע חשוב ללמד תכנות כבר בגיל צעיר', 'לא כל ילד יהיה מתכנת, אבל כולם יחיו בעולם של קוד.', 'ההבנה כיצד מערכות פועלות מחזקת חשיבה ביקורתית ויכולת פתרון בעיות.'),
    en('The Case for a Four-Day Work Week Is Stronger Than You Think', 'Pilot programs show maintained output and happier employees.', 'The strongest objections turn out to be about management habits rather than economics.'),
    he('אל תזלזלו בכוחה של שכנות טובה', 'קהילה מקומית חזקה היא המענה הטוב ביותר לבדידות עירונית.', 'מפגש קצר בחצר הבניין יכול לשנות את התחושה בשכונה יותר מכל תוכנית ממשלתית.'),
  ],
  culture: [
    en('Old City Bookshop Celebrates a Century of Trade', 'Generations of readers have browsed its crowded shelves.', "The owner's grandchildren now run the shop and have added a small reading room and a weekly poetry night."),
    he('תערוכה חדשה במוזיאון תל אביב חושפת יצירות שלא הוצגו מעולם', 'האוצרים בחרו יותר ממאה עבודות מהאוספים הפרטיים.', 'התערוכה תפתח את שעריה בשבוע הבא ותישאר במקום עד סוף החורף.'),
    en('Traditional Weavers Find a New Audience Online', 'Village cooperatives now sell rugs to buyers on three continents.', 'Younger members handle photography and shipping, while elders keep alive patterns that date back generations.'),
    he('פסטיבל הספרות הבינלאומי חוגג עשור עם אורחים מרחבי העולם', 'הכותבים ידונו בתרגום, בזיכרון ובעתיד הספר.', 'לצד המפגשים יתקיימו סדנאות כתיבה וערבי קריאה בבתי קפה ברחבי העיר.'),
    en("A Walking Tour of the City's Hidden Murals", 'Street artists have turned back alleys into open-air galleries.', 'The route takes about two hours and ends at a courtyard where the oldest of the works still stands.'),
    he('הצגת הבכורה של הבלט הישראלי זכתה לתשואות סוערות', 'היצירה משלבת מוזיקה קלאסית עם מחול עכשווי.', 'הקהל קם על רגליו בסיום, והכוריאוגרפית הודתה למחולליה בדמעות.'),
    en('Language Revival Project Records the Last Fluent Speakers', 'Linguists race to document stories and songs before they are lost.', 'Recordings will be made available to schools so that young people can learn from the voices of elders.'),
    he('מסורת הבישול המשפחתי חוזרת אל המסעדות', 'שפים צעירים מחדשים מתכונים שעברו מדור לדור.', 'הנוסטלגיה, הם מסבירים, היא מרכיב חשוב לא פחות מהטעם.'),
    en('Library Turns Unused Floor Into a Community Maker Space', 'Free workshops in sewing, woodworking and electronics start this month.', 'Librarians say the space has been booked solid since registration opened.'),
    he('קונצרט הפתיחה של העונה במוזיאון ישראל הסתיים בהתרגשות', 'הנגנים ביצעו יצירות מאת מלחינים ישראלים צעירים.', 'התזמורת הודיעה על סדרת קונצרטים נוספת שתתקיים בגנים הציבוריים.'),
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

export const GUEST_NAMES = ['נועה', 'דניאל', 'Maya', 'Tom', 'שירה', 'Yossi', 'Lior', 'Hannah', 'עומר', 'Sam'];
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
