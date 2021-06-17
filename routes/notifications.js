const express = require("express");
const prisma = require("./db");
const router = express.Router();

const dates = require("../helpers/dates");
const { successResponse, errorResponse } = require("../helpers/apiResponser");

// LIST ALL NOTIFICATIONS //
router.get("/", process.middlewares, async (req, res) => {
    try {
        const notifications = await prisma.message.findMany({
            where: {
                deleted: !true,
                type_id: 1,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Notification listed succesfully",
                es: "Se han listado las notificaciónes correctamente",
            },
            body: notifications,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// GET NOTIFICATION BY ID //
router.get("/:id", process.middlewares, async (req, res) => {
    try {
        const notificationId = +req.params.id;
        if (!Number.isInteger(notificationId))
            throw new Error("Missing Event id");
        const notification = await prisma.message.findUnique({
            where: { id: notificationId },
        });
        if (notification) {
            return successResponse({
                res,
                message: {
                    en: "Notification listed succesfully",
                    es: "Se han listado las notificacións correctamente",
                },
                body: notification,
            });
        } else {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "No Notification registered",
                    es: "No hay notificacións registradas",
                },
                error: JSON.stringify("Error"),
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// UPDATE NOTIFICATIONS BY ID //
router.put("/:id", process.middlewares, async (req, res) => {
    try {
        const notificationId = +req.params.id;
        if (!Number.isInteger(notificationId)) {
            throw new Error("Id is not valid");
        }
        let data = req.body;
        const now = dates.getCurrentDate();
        data.last_edit = now;
        delete data.id;
        const updated = await prisma.message.update({
            where: { id: notificationId },
            data,
        });
        return successResponse({
            res,
            message: {
                en: "Notification updated succesfully",
                es: "Se han actualizado la notificación correctamente",
            },
            body: updated,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// DELETE A NOTIFICATION BY ID //
router.put("/:id/delete", process.middlewares, async (req, res) => {
    try {
        const notificationId = +req.params.id;
        if (!Number.isInteger(notificationId)) {
            throw new Error("Id is not valid");
        }
        const now = dates.getCurrentDate();
        const deleted = await prisma.message.update({
            where: { id: notificationId },
            data: {
                deleted: true,
                last_edit: now,
                deleted_at: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Notification deleted succesfully",
                es: "Se ha eliminado la notificación correctamente",
            },
            body: deleted,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// DUPLICATE BY ID //
router.post("/:id/duplicate", process.middlewares, async (req, res) => {
    try {
        const notificationId = +req.params.id;
        if (!Number.isInteger(notificationId)) {
            throw new Error("Id is not valid");
        }
        const notification = await prisma.message.findUnique({
            where: { id: notificationId },
        });
        if (!notification) {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "No Notification registered with that id",
                    es: "No hay notificacións registradas con ese id",
                },
                error: JSON.stringify("Error"),
            });
        }
        let data = {};
        if (notification) {
            data = Object.assign({}, notification);
        }
        data.project = {
            connect: { id: Number(data.project_id) },
        };
        data.organization = {
            connect: { id: Number(data.organization_id) },
        };
        data.message_type = { connect: { id: 1 } };
        data.user = {
            connect: { id: Number(data.author_id) },
        };
        data.message_type = { connect: { id: 1 } };
        delete data.id;
        delete data.project_id;
        delete data.organization_id;
        delete data.messag_type;
        delete data.author_id;
        delete data.type_id;
        const newNotification = await prisma.message.create({
            data,
        });
        if (newNotification) {
            return successResponse({
                res,
                message: {
                    en: "Notification duplicated succesfully",
                    es: "La notificación se ha copiado exitosamente",
                },
                body: newNotification,
            });
        } else {
            return errorResponse({
                res,
                code: 400,
                message: {
                    en: "Notification could not be duplicated",
                    es: "No se ha podido duplicar la notificación",
                },
                error: data,
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//const publishNotification = async (event) => {
router.put("/:id/publish/", process.middlewares, async (req, res) => {
    try {
        const notificationId = +req.params.id;
        if (!Number.isInteger(notificationId)) {
            throw new Error("Id is not valid");
        }
        const now = dates.getCurrentDate();
        const published = await prisma.message.update({
            where: { id: notificationId },
            data: {
                published: true,
                published_at: now,
                last_edit: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Notification posted succesfully",
                es: "Se ha publicado la notificación correctamente",
            },
            body: published,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// UNPUBLISH NOTIFICATION
router.put("/:id/unpublish", process.middlewares, async (req, res) => {
    try {
        const notificationId = +req.params.id;
        if (!Number.isInteger(notificationId)) {
            throw new Error("Notifications Id is not valid");
        }
        const now = dates.getCurrentDate();
        const published = await prisma.message.update({
            where: { id: notificationId },
            data: {
                published: false,
                published_at: now,
                last_edit: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Notification unpublished succesfully",
                es: "Se ha despublicado la notificaciónß correctamente",
            },
            body: published,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// *CHANGED* from /project/:id/notification > to > /notification/project/:id //
// ADD A NOTIFICATION TO PROJECT //
router.post("/projects/:id", process.middlewares, async (req, res) => {
    try {
        const id = +req.params.id;
        if (!Number.isInteger(id)) throw new Error("Missing Event id");
        const sub = req.currentUser.sub;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });
        if (user) {
            let createNotification = Object.assign({}, req.body);
            delete createNotification.project_id;
            delete createNotification.organization_id;
            delete createNotification.sub;
            if (!createNotification.locations) {
                createNotification.locations = {};
            }
            createNotification.project = {
                connect: { id: id },
            };
            createNotification.organization = {
                connect: { id: Number(req.body.organization_id) },
            };
            createNotification.message_type = { connect: { id: 1 } };
            createNotification.user = { connect: { id: user.id } };
            const notification = await prisma.message.create({
                data: createNotification,
            });
            if (notification) {
                return successResponse({ res, body: notification });
            } else {
                return errorResponse({
                    res,
                    code: 400,
                    message: {
                        en: "Notification could not be created",
                        es: "No se ha podido crear la notificación",
                    },
                    error: createNotification,
                });
            }
        } else {
            return successResponse({
                res,
                message: {
                    en: "User does not exists",
                    es: "No existe un usuario asociado",
                },
                body: req.body,
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({
            res,
            message: {
                en: "Notification could not be created, server error",
                es: "No se ha podido crear la notificación",
            },
            error: req.body,
        });
    } 
});

// *CHANGED* from /projects/:id/notification > to > /notification/project/:id //
// LIST ALL NOTIFICATIONS BY PROJECT //
router.get("/projects/:id", process.middlewares, async (req, res) => {
    try {
        const project_id = +req.params.id;
        if (!Number.isInteger(project_id)) throw new Error("Missing Event id");
        const notifications = await prisma.message.findMany({
            where: {
                deleted: !true,
                type_id: 1,
                project_id: project_id,
            },
        });
        return successResponse({
            res,
            message: {
                en: "project notifications listed succesfully",
                es: "Se han listado las notificaciones correctamente",
            },
            body: notifications,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

module.exports = router;
