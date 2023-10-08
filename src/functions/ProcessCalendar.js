const { app } = require('@azure/functions');
const icalendar = require("icalendar");

app.http('ProcessCalendar', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (!request.query.timetable_url) {
            return { status: 400 };
        }

        const upstreamRes = await fetch(decodeURIComponent(request.query.timetable_url))
        const upstreamIcal = await upstreamRes.text();
        const calendar = icalendar.parse_calendar(upstreamIcal);

        for (let evt of calendar.events()) {

            // fix duplicate timezone data (we can only have one of time zone name or offset in the iCal)
            // see https://icalendar.org/iCalendar-RFC-5545/3-3-5-date-time.html
            // we remove the time zone name specifier and just use the Zulu date time instead
            delete evt.properties["DTSTART"][0].parameters.TZID;
            delete evt.properties["DTEND"][0].parameters.TZID;

            // change to transparent ('free') if the title includes 'optional'
            if (evt.getPropertyValue("SUMMARY").toUpperCase().includes("OPTIONAL")) {
                evt.setProperty("TRANSP", "TRANSPARENT");
            }

            // extract properties from the event's description: key/value separated by colons, and each entry by two new lines
            const descLines = evt.getPropertyValue("DESCRIPTION").split("\n\n");
            const descProperties = Object.fromEntries(descLines
                .filter(l => l.includes(": "))
                .map(l => {
                    const split = l.indexOf(": ");
                    return [l.slice(0, split), l.slice(split + 2)];
                }));

            if (descProperties["Module description"] && descProperties["Type"]) {

                // Module title starts with three 0s - this means it's a cohort activity, so likely to already have a good event summary
                if (descProperties["Module description"].startsWith("000")) {
                    continue;
                }

                let type = descProperties["Type"];
                if (evt.getPropertyValue("SUMMARY").toUpperCase().includes("PROBLEM CLASS")) {
                    type = "Problem Class";
                }

                const newTitle = descProperties["Module description"].split(":", 1) + " (" + type + ")"
                const newDescription = evt.getPropertyValue("DESCRIPTION") + "\n\nTitle replaced by UoYCalendarProcessor. Original title: '" + evt.getPropertyValue("SUMMARY") + "'.";
                evt.setProperty("DESCRIPTION", newDescription);
                evt.setProperty("SUMMARY", newTitle);
            }
        }

        context.log("Processed calendar!");

        return { body: calendar.toString() };
    }
});
