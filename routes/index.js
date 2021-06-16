const express = require("express");
const app = express();

app.use("/reports", require("./reports"));
app.use("/users", require("./users"));
app.use("/programs", require("./programs"));
app.use("/resources", require("./resources"));
app.use("/events", require("./events"));
app.use("/emails", require("./emails"));
app.use("/news", require("./news"));
app.use("/notifications", require("./notifications"));
app.use("/knowledge", require("./knowledge"));
app.use("/surveys", require("./surveys"));
app.use("/analytics", require("./analytics"));
app.use("/organizations", require("./organizations"));
app.use("/projects", require("./projects"));
//*CHANGED* Base route from /citizen > to > /citizens
app.use("/citizens", require("./citizens"));
app.use("/workers", require("./workers"));
app.use("/roles", require("./roles"))

module.exports = app;
