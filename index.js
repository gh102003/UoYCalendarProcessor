const ical = require("node-ical");
const express = require("express");
require("dotenv").config();

const app = express();

app.get("/", async (req, res) => {
    const events = await ical.async.fromURL(process.env.TIMETABLE_URL);

    for (let key of Object.keys(events)) {
        const evt = events[key];
        if (evt.type !== "VEVENT") {
            continue;
        }

        // extract properties from the event's description: key/value separated by colons, and each entry by two new lines
        const descLines = evt.description.split("\n\n");
        const descProperties = Object.fromEntries(descLines
            .filter(l => l.includes(": "))
            .map(l => {
                const split = l.indexOf(": ");
                return [l.slice(0, split), l.slice(split + 2)];
            }));

        console.log(descProperties);
            
        if (descProperties["Module description"] && descProperties["Type"]) {
            
            // Module title starts with three 0s - this means it's a cohort activity, so likely to already have a good event summary
            if (descProperties["Module description"].startsWith("000")) {
                continue;
            }

            const newTitle = descProperties["Module description"].split(":", 1) + " (" + descProperties["Type"] + ")"
            console.log(newTitle);
            evt.description += "\n\nTitle replaced by UoYCalendarProcessor. Original title: '" + evt.summary + "'.";
            evt.summary = newTitle;
        }
    }

    return res.status(200).json(events);
});

app.listen(3000, () => {
    console.log("listening for requests...");
});