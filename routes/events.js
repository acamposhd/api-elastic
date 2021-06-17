const express = require("express");
const prisma = require("./db");
const router = express.Router();
const dates = require("../helpers/dates");
const { successResponse, errorResponse } = require("../helpers/apiResponser");

//Get events
router.get("/", process.middlewares, async (req, res) => {
    try {
        let params = {};
        const { body } = req;
        params.take = body.offset || 50;
        params.include = { event_topic: true };
        params.where = { deleted: !true };
        if (body.from) {
            params.cursor = body.from;
        }
        const events = await prisma.event.findMany(params);
        return successResponse({ res, body: events });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//Get events by project id
router.get("/projects/:id", process.middlewares, async (req, res) => {
    try {
        const id = +req.params.id;
        const { status } = req.params;
        if (!Number.isInteger(id)) throw new Error("Missing project id");
        let params = {};
        let where = { deleted: !true, project_id: id };
        const now = new Date();
        if (status === "available") {
            where.published = true;
            where.end_at = { gt: now };
        }
        params.where = where;
        params.include = { event_topic: true };
        params.orderBy = {
            start_at: "asc",
        };
        const projects_events = await prisma.event.findMany(params);
        return successResponse({
            res,
            message: {
                en: "Events listed succesfully",
                es: "Se han listado los eventos correctamente",
            },
            body: projects_events,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

//Get user's events by project
router.get("/projects/:id/my_events", process.middlewares, async (req, res) => {
    try {
        const cognito = req.currentUser.sub;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: cognito },
        });
        if (user === null || user === undefined) {
            throw "Invalid user";
        }
        const project_id = +req.params.id;
        if (!Number.isInteger(project_id))
            throw new Error("Missing project id");
        const user_events = await prisma.user_event.findMany({
            where: { deleted: !true, user_id: user.id, project_id: project_id },
            include: {
                event: {
                    include: { event_topic: true },
                },
            },
            take: 100,
            orderBy: { created_at: "desc" },
        });
        return successResponse({
            res,
            message: {
                en: "User Events listed succesfully",
                es: "Se han listado los eventos del usuario correctamente",
            },
            body: user_events,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

//Get event
router.get("/:id", process.middlewares, async (req, res) => {
    try {
        const id = +req.params.id;
        if (!Number.isInteger(id)) throw new Error("Missing Event id");
        const readEvent = await prisma.event.findUnique({
            where: { id },
            include: { event_topic: true },
        });
        return successResponse({ res, body: readEvent });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//Get event topics
router.get("/topics/all", process.middlewares, async (req, res) => {
    try {
        const eventsTopic = await prisma.event_topic.findMany({});
        return successResponse({ res, body: eventsTopic });
    } catch (error) {
        console.log("Error reading Events topic :", error);
        return errorResponse({ res, error });
    } 
});

//Get event topic
router.get("/topic/:id", process.middlewares, async (req, res) => {
    try {
        const id = +req.params.id;
        if (!Number.isInteger(id)) throw new Error("Missing Event topic id");
        const readEvent = await prisma.event_topic.findUnique({
            where: { id },
        });
        return successResponse({ res, body: readEvent });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//Get event topics by project
router.get("/projects/:id/topics", process.middlewares, async (req, res) => {
    try {
        const project_id = +req.params.id;
        if (!Number.isInteger(project_id)) throw new Error("Missing Event id");
        const projects_events = await prisma.event_topic.findMany({
            where: { project_id: project_id, deleted: !true },
        });
        return successResponse({
            res,
            message: {
                en: "Events topic listed succesfully",
                es: "Se han listado los topicos de eventos correctamente",
            },
            body: projects_events,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

//Create event
router.post("/", process.middlewares, async (req, res) => {
    try {
        const { body } = req;
        let createEvent = Object.assign({}, body);
        delete createEvent.project_id;
        delete createEvent.organization_id;
        delete createEvent.topic_id;
        delete createEvent.create_on_eventbrite;
        delete createEvent.start_at;
        delete createEvent.end_at;
        createEvent.start_at = new Date(body.start_at).toISOString();
        createEvent.end_at = new Date(body.end_at).toISOString();
        if (!body.timezone) {
            createEvent.timezone = `(UTC) Coordinated Universal Time`;
        }
        console.log({ body });
        const createdEvent = await prisma.event.create({
            data: Object.assign(Object.assign({}, createEvent), {
                project: { connect: { id: body.project_id } },
                organization: { connect: { id: body.organization_id } },
                //FIXME workarround
                event_topic: { connect: { id: body.topic_id ?? 1 } },
            }),
        });
        if (body.longitude && body.latitude) {
            await prisma.$executeRaw`UPDATE event SET location = point(${body.longitude}, ${body.latitude}) WHERE id = ${createdEvent.id} RETURNING *;`;
        }
        if (body.create_on_eventbrite) {
            //To do: Create event with connected account
            console.log(createdEvent.id);
        }
        return successResponse({ res, body });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//Create user's event
router.post(
    "/projects/:id/my_events",
    process.middlewares,
    async (req, res) => {
        try {
            const cognito = req.currentUser.sub;
            const eventId = +req.body.event_id;
            const projectId = +req.params.id;
            if (!Number.isInteger(eventId)) {
                throw new Error("Missing Event integer id");
            }
            if (!Number.isInteger(projectId)) {
                throw new Error("Missing Event integer id");
            }
            const user = await prisma.user.findUnique({
                where: { cognito_sub: cognito },
            });
            if (user === null || user === undefined) {
                throw "Invalid user";
            }
            const appEvent = await prisma.event.findUnique({
                where: { id: eventId },
            });
            if (appEvent === null || appEvent === undefined) {
                throw "Invalid event";
            }
            let createData = {};
            createData.user = { connect: { id: user.id } };
            createData.event = { connect: { id: appEvent.id } };
            createData.organization = {
                connect: { id: req.body.organization_id },
            };
            createData.project = { connect: { id: projectId } };
            const user_event = await prisma.user_event.upsert({
                where: {
                    user_event_event_id_user_id_idx: {
                        user_id: user.id,
                        event_id: appEvent.id,
                    },
                },
                create: createData,
                update: { deleted: false },
            });
            return successResponse({
                res,
                message: {
                    en: "User Event saved listed succesfully",
                    es: "Se han guardado el evento del usuario correctamente",
                },
                body: user_event,
            });
        } catch (error) {
            console.error(error);
            return errorResponse({ res, error });
        } finally {
            console.log("Close DB");
            await prisma.$disconnect();
        }
    }
);

//Create project event topic
router.post("/projects/:id/topics", process.middlewares, async (req, res) => {
    try {
        const projectId = +req.params.id;
        if (!Number.isInteger(projectId)) {
            throw new Error("Missing Event integer id");
        }
        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });
        if (project && project.organization_id) {
            let data = Object.assign({}, req.body);
            delete data.project_id;
            data.project = { connect: { id: projectId } };
            data.organization = { connect: { id: project.organization_id } };
            const result = await prisma.event_topic.create({
                data,
            });
            return successResponse({ res, body: result });
        } else {
            return errorResponse({ res, error: "Invalid Project" });
        }
    } catch (error) {
        //More error management
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//Create event topic
router.post("/topics", process.middlewares, async (req, res) => {
    try {
        let data = Object.assign({}, req.body);
        const result = await prisma.event_topic.create({
            data,
        });
        return successResponse({ res, body: result });
    } catch (error) {
        //More error management
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//Update event
router.put("/:id", process.middlewares, async (req, res) => {
    try {
        const { body } = req;
        const eventId = +req.params.id;
        if (!Number.isInteger(eventId)) {
            throw new Error("Missing Event integer id");
        }
        let data = Object.assign(Object.assign({}, body), {
            last_edit: dates.getCurrentDate(),
        });
        if (data.start_at) {
            data.start_at = new Date(body.start_at).toISOString();
        }
        if (data.end_at) {
            data.end_at = new Date(body.end_at).toISOString();
        }
        if (data.topic_id) {
            data.event_topic = { connect: { id: data.topic_id } };
            delete data.topic_id;
        }
        const update = await prisma.event.update({
            where: { id: eventId },
            data,
        });
        if (data.longitude && data.latitude) {
            await prisma.$executeRaw`UPDATE event SET location = point(${data.longitude}, ${data.latitude}) WHERE id = ${eventId} RETURNING *;`;
        }
        return successResponse({ res, body: update });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//Update event topic
router.put("/topics/:id", process.middlewares, async (req, res) => {
    try {
        const id = +req.params.id;
        if (!Number.isInteger(id)) {
            throw new Error("Missing Event topic integer id");
        }
        let data = Object.assign({}, req.body);
        const update = await prisma.event_topic.update({
            where: { id },
            data,
        });
        return successResponse({ res, body: update });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//Publish event
router.put("/:id/publish", process.middlewares, async (req, res) => {
    try {
        const eventId = +req.params.id;
        if (!Number.isInteger(eventId)) {
            throw new Error("Id is not valid");
        }
        const now = dates.getCurrentDate();
        const published = await prisma.event.update({
            where: { id: eventId },
            data: {
                published: true,
                published_at: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Event posted succesfully",
                es: "Se ha publicado el evento correctamente",
            },
            body: published,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//Unpublish event
router.put("/:id/unpublish", process.middlewares, async (req, res) => {
    try {
        const eventId = +req.params.id;
        if (!Number.isInteger(eventId)) {
            throw new Error("Id is not valid");
        }
        const now = dates.getCurrentDate();
        const published = await prisma.event.update({
            where: { id: eventId },
            data: {
                published: false,
                published_at: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Event unpublished succesfully",
                es: "Se ha despublicado el evento correctamente",
            },
            body: published,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//Duplicate event
router.put("/:id/duplicate", process.middlewares, async (req, res) => {
    try {
        const { body } = req;
        const eventId = +req.params.id;
        if (!Number.isInteger(eventId)) {
            throw new Error("Id is not valid");
        }
        const findEvent = await prisma.event.findUnique({
            where: { id: eventId },
        });
        if (!findEvent) {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "No event registered with that id",
                    es: "No hay un evento registrado con ese id",
                },
                error: "Error",
            });
        }
        let data = {};
        if (body) {
            data = Object.assign({}, body);
        }
        delete data.id;
        const duplicateEvent = await prisma.$executeRaw(`
      INSERT INTO event( 
        address, zipcode, description, title, image, latitude, longitude,
        start_at, end_at, organization_id, project_id, topic_id, location, website_link
      )
      SELECT address, zipcode, description, title, image, latitude, longitude,
      start_at, end_at, organization_id, project_id, topic_id, location, website_link
      FROM event WHERE id=${eventId};`);
        if (duplicateEvent) {
            return successResponse({
                res,
                message: {
                    en: "Event duplicated succesfully",
                    es: "El evento se ha copiado exitosamente",
                },
                body: duplicateEvent,
            });
        } else {
            return errorResponse({
                res,
                code: 400,
                message: {
                    en: "Event could not be duplicated",
                    es: "No se ha podido duplicar el evento",
                },
                error: data,
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//Remove user event
router.put("/my_events/:id/delete", process.middlewares, async (req, res) => {
    try {
        const userEventId = +req.params.id;
        if (!Number.isInteger(userEventId)) {
            throw new Error("Missing User Event integer id");
        }
        const now = dates.getCurrentDate();
        let data = {
            last_edit: now,
            deleted: true,
            deleted_at: now,
        };
        const update = await prisma.user_event.update({
            where: { id: userEventId },
            data,
        });
        return successResponse({ res, body: update });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//Delete event (logical)
router.put("/:id/delete", process.middlewares, async (req, res) => {
    try {
        const eventId = +req.params.id;
        console.log("entra");
        if (!Number.isInteger(eventId)) {
            throw new Error("Missing Event integer id");
        }
        const now = dates.getCurrentDate();
        let data = {
            last_edit: now,
            deleted: true,
            deleted_at: now,
        };
        const update = await prisma.event.update({
            where: { id: eventId },
            data,
        });
        return successResponse({ res, body: update });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//Delete event (physical)
router.delete("/:id", process.middlewares, async (req, res) => {
    try {
        const eventId = +req.params.id;
        if (!Number.isInteger(eventId)) {
            throw new Error("Missing integer id");
        }
        const deletion = await prisma.event.delete({
            where: { id: eventId },
        });
        return successResponse({ res, body: deletion });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

module.exports = router;
