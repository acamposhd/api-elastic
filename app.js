const createError = require("http-errors");
const express = require("express"),
    swaggerJsdoc = require("swagger-jsdoc"),
    swaggerUi = require("swagger-ui-express");
require("./middlewares/index");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const indexRouter = require("./routes/index");
const cors = require("cors");
const app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

//express configs
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Habilitar CORS
app.use(cors());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Authorization, Origin, X-Requested-With, Content-Type, Accept"
    );
    res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS, PUT, DELETE, PATCH"
    );
    res.header("Allow", "GET, POST, OPTIONS, PUT, DELETE, PATCH");
    next();
});

//set swagger config file
const swaggerOptions = require("./swagger.json");
const options = {
    definition: swaggerOptions,
    apis: ["./routes/index"],
};
const specs = swaggerJsdoc(options);
app.use("/", swaggerUi.serve);
app.get("/", swaggerUi.setup(specs, { explorer: true }));

// set endpoint for routers
app.use("/api/v1", indexRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
    next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};
    res.status(err.status || 500);
    res.render("error");
});

module.exports = app;
