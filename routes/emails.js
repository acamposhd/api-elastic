const express = require("express");
const prisma = require("./db");
const router = express.Router();
const dates = require("../helpers/dates");
const { successResponse, errorResponse } = require("../helpers/apiResponser");

//Helpers
//Create email helper
const createUserEmail = async (
    destinatary_id,
    mail_id,
    project_id,
    organization_id,
    last_edit
) => {
    await prisma.user_mail.create({
        data: {
            user: { connect: { id: destinatary_id } },
            mail: { connect: { id: mail_id } },
            project: { connect: { id: project_id } },
            organization: { connect: { id: organization_id } },
            last_edit: last_edit,
        },
    });
    return;
};

//Create email attachment
const createMailAttachment = async (
    attachment,
    mail_reply_id,
    project_id,
    organization_id
) => {
    const attachmentData = {
        url: attachment.url,
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
        mail_reply: { connect: { id: mail_reply_id } },
        project: { connect: { id: project_id } },
        organization: { connect: { id: organization_id } },
    };
    await prisma.reply_attachment.create({
        data: attachmentData,
    });
    return;
};
//End helpers

// *CHANGED* from /projects/1/emails/received > to > /emails/projects/:id/received
// GET WORKERS EMAILS //
router.get("/projects/:id/received", process.middlewares, async (req, res) => {
    try {
        const projectId = +req.params.id;
        if (!Number.isInteger(projectId)) {
            throw new Error("Missing integer id");
        }
        const { sub } = req.currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });
        if (!user) {
            return errorResponse({
                res,
                message: {
                    en: "User does not exists",
                    es: "No existe un usuario asociado",
                },
                error: body,
            });
        }
        let emails = await prisma.user_mail.findMany({
            where: {
                user_id: user.id,
                deleted: !true,
                project_id: projectId,
            },
            orderBy: { last_edit: "desc" },
            select: {
                id: true,
                starred: true,
                archive: true,
                last_edit: true,
                read: true,
                mail: {
                    select: {
                        id: true,
                        subject: true,
                        created_at: true,
                        user: {
                            select: {
                                name: true,
                                id: true,
                                email: true,
                                image: true,
                            },
                        },
                        mail_reply: {
                            where: { deleted: !true },
                            orderBy: { created_at: "desc" },
                            take: 1,
                            select: {
                                id: true,
                                body: true,
                                user: {
                                    select: {
                                        name: true,
                                        id: true,
                                        email: true,
                                        image: true,
                                    },
                                },
                                created_at: true,
                                reply_attachment: {
                                    select: {
                                        type: true,
                                        size: true,
                                        url: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        return successResponse({ res, body: emails });
    } catch (error) {
        //More error management
        return errorResponse({
            res,
            message: {
                en: "Emails could not be found",
                es: "No se encontraron emails para el usuario",
            },
            error,
        });
    } 
});

// *CHANGED* from /projects/1/emails/archive > to > /emails/projects/:id/archived
// GET ARCHIVED EMAILS //
router.get("/projects/:id/archived", process.middlewares, async (req, res) => {
    try {
        const projectId = +req.params.id;
        if (!Number.isInteger(projectId)) {
            throw new Error("Missing integer id");
        }
        const { sub } = req.currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });
        if (!user) {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "User does not exists",
                    es: "No existe un usuario asociado",
                },
                error: "User do not exists",
            });
        }
        const emails = await prisma.user_mail.findMany({
            where: {
                user_id: user.id,
                deleted: !true,
                archive: true,
                project_id: projectId,
            },
            select: {
                id: true,
                starred: true,
                archive: true,
                read: true,
                mail: {
                    select: {
                        subject: true,
                        created_at: true,
                        user: {
                            select: {
                                name: true,
                                id: true,
                                email: true,
                            },
                        },
                        mail_reply: {
                            where: { deleted: !true },
                            orderBy: { created_at: "desc" },
                            take: 1,
                            select: {
                                id: true,
                                user: {
                                    select: {
                                        name: true,
                                        email: true,
                                        image: true,
                                    },
                                },
                                created_at: true,
                                reply_attachment: {
                                    select: {
                                        type: true,
                                        size: true,
                                        url: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        console.log({ emails });
        return successResponse({ res, body: emails });
    } catch (error) {
        //More error management
        return errorResponse({
            res,
            message: {
                en: "Emails could not be found",
                es: "No se encontraron emails para el usuario",
            },
            error,
        });
    } 
});

// GET EMAIL //
router.get("/:id", process.middlewares, async (req, res) => {
    try {
        const id = +req.params.id;
        if (!Number.isInteger(id)) throw new Error("Missing user email id");
        const { sub } = req.currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });
        if (!user) {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "User does not exists",
                    es: "No existe un usuario asociado",
                },
                error: "User does not exists",
            });
        }
        const readEmail = await prisma.user_mail.findUnique({
            where: { id },
            select: {
                id: true,
                starred: true,
                archive: true,
                user_id: true,
                read: true,
                mail: {
                    select: {
                        id: true,
                        created_at: true,
                        subject: true,
                        mail_reply: {
                            take: 100,
                            where: { deleted: !true },
                            select: {
                                id: true,
                                reply_attachment: {
                                    select: {
                                        id: true,
                                        size: true,
                                        name: true,
                                        type: true,
                                        url: true,
                                    },
                                },
                                user: {
                                    select: {
                                        name: true,
                                        email: true,
                                        id: true,
                                        image: true,
                                    },
                                },
                                body: true,
                                created_at: true,
                            },
                            orderBy: { created_at: "asc" },
                        },
                        user: {
                            select: {
                                name: true,
                                email: true,
                                id: true,
                                image: true,
                            },
                        },
                    },
                },
            },
        });
        if (readEmail && readEmail.user_id !== user.id) {
            return errorResponse({
                res,
                error: "You can not access to this resources",
            });
        }
        await prisma.user_mail.update({
            where: { id: readEmail.id },
            data: {
                read: true,
            },
        });
        return successResponse({ res, body: readEmail });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// *CHANGED* from /projects/1/emails > to > /emails/projects/:id
// CREATE EMAIL //
router.post("/projects/:id", process.middlewares, async (req, res) => {
    try {
        const projectId = +req.params.id;
        if (!Number.isInteger(projectId)) {
            throw new Error("Missing integer id");
        }
        const event = req.body;
        if (
            !event.webapp &&
            event.destinataries &&
            event.destinataries.length === 0
        ) {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "At least one destinatary is required",
                    es: "Se requirere al menos un destinatarioa",
                },
                error: event,
            });
        }
        const { sub } = req.currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });
        if (!user) {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "User does not exists",
                    es: "No existe un usuario asociado",
                },
                error: event,
            });
        }
        let createEmail = Object.assign({}, event);
        delete createEmail.project_id;
        delete createEmail.organization_id;
        delete createEmail.destinataries;
        delete createEmail.attachments;
        delete createEmail.sub;
        delete createEmail.reply_body;
        delete createEmail.webapp;
        createEmail.project = {
            connect: { id: Number(projectId) },
        };
        createEmail.organization = {
            connect: { id: Number(event.organization_id) },
        };
        createEmail.user = { connect: { id: user.id } };
        const now = dates.getCurrentDate();
        if (event.webapp) {
            const createdReply = await prisma.mail_reply.create({
                data: {
                    mail: {
                        create: createEmail,
                    },
                    body: event.reply_body,
                    user: { connect: { id: user.id } },
                    project: { connect: { id: Number(projectId) } },
                    organization: {
                        connect: { id: Number(event.organization_id) },
                    },
                },
                select: {
                    mail: {
                        select: {
                            id: true,
                        },
                    },
                    id: true,
                },
            });
            const createdEmail = createdReply.mail;
            const allProjectWorkers = await prisma.worker_project.findMany({
                where: { project_id: projectId, deleted: !true },
                select: { user_id: true, id: true },
            });
            await Promise.all(
                allProjectWorkers.map(async (destinatary) => {
                    createUserEmail(
                        destinatary.user_id,
                        createdEmail.id,
                        projectId,
                        event.organization_id,
                        now
                    );
                })
            );
            if (
                !allProjectWorkers.find((worker) => worker.user_id === user.id)
            ) {
                createUserEmail(
                    user.id,
                    createdEmail.id,
                    projectId,
                    event.organization_id,
                    now
                );
            }
            await Promise.all(
                event.attachments.map((attachment) => {
                    createMailAttachment(
                        attachment,
                        createdReply.id,
                        projectId,
                        event.organization_id
                    );
                })
            );
        } else {
            let allDestinataries = event.destinataries;
            allDestinataries = allDestinataries.filter(
                (destinatary) => destinatary.id !== user.id
            );
            // allDestinataries.push({id : user.id})
            await Promise.all(
                allDestinataries.map(async (destinatary) => {
                    const createdReply = await prisma.mail_reply.create({
                        data: {
                            mail: {
                                create: createEmail,
                            },
                            body: event.reply_body,
                            user: { connect: { id: user.id } },
                            project: {
                                connect: { id: Number(projectId) },
                            },
                            organization: {
                                connect: { id: Number(event.organization_id) },
                            },
                        },
                        select: {
                            mail: {
                                select: {
                                    id: true,
                                },
                            },
                            id: true,
                        },
                    });
                    const createdEmail = createdReply.mail;
                    createUserEmail(
                        destinatary.id,
                        createdEmail.id,
                        projectId,
                        event.organization_id,
                        now
                    );
                    await Promise.all(
                        event.attachments.map((attachment) => {
                            createMailAttachment(
                                attachment,
                                createdReply.id,
                                projectId,
                                event.organization_id
                            );
                        })
                    );
                })
            );
        }
        return successResponse({ res, body: true });
    } catch (error) {
        console.error(error);
        return errorResponse({
            res,
            message: {
                en: "Email could not be created, server error",
                es: "No se ha podido crear el mail",
            },
            error,
        });
    } 
});

// CREATE REPLY //
router.post("/:id/reply", process.middlewares, async (req, res) => {
    try {
        const mailId = +req.params.id;
        if (!Number.isInteger(mailId)) {
            throw new Error("Missing integer id");
        }
        const { sub } = req.currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });
        if (!user) {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "User does not exists",
                    es: "No existe un usuario asociado",
                },
                error: "User does not exists",
            });
        }
        const mail = await prisma.mail.findUnique({
            where: { id: mailId },
        });
        if (!mail) {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "Email does not exists",
                    es: "No existe un email asociado",
                },
                error: "Email does not exists",
            });
        }
        let createReply = {
            body: req.body.body,
        };
        createReply.project = {
            connect: { id: Number(mail.project_id) },
        };
        createReply.organization = {
            connect: { id: Number(mail.organization_id) },
        };
        createReply.mail = {
            connect: { id: Number(mail.id) },
        };
        createReply.user = { connect: { id: user.id } };
        let attachmentData = [];
        if (req.body.attachments) {
            attachmentData = req.body.attachments.map((attachment) => {
                return Object.assign(Object.assign({}, attachment), {
                    project_id: mail.project_id,
                    organization_id: mail.organization_id,
                });
            });
        }
        createReply.reply_attachment = attachmentData;
        const createdReply = await prisma.mail_reply.create({
            data: Object.assign(Object.assign({}, createReply), {
                reply_attachment: {
                    createMany: {
                        data: attachmentData,
                        skipDuplicates: true,
                    },
                },
            }),
            select: {
                mail: {
                    select: {
                        id: true,
                    },
                },
                id: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        image: true,
                    },
                },
            },
        });
        const now = dates.getCurrentDate();
        if (user.id !== mail.author_id) {
            await prisma.user_mail.upsert({
                update: { last_edit: now, read: false },
                create: {
                    user: { connect: { id: mail.author_id } },
                    mail: { connect: { id: mail.id } },
                    project: { connect: { id: mail.project_id } },
                    organization: { connect: { id: mail.organization_id } },
                    last_edit: now,
                    read: false,
                },
                where: {
                    user_mail_user_id_mail_id_idx: {
                        user_id: mail.author_id,
                        mail_id: mail.id,
                    },
                },
            });
            await prisma.user_mail.updateMany({
                where: {
                    mail: { id: mail.id },
                    user_id: { notIn: [user.id, mail.author_id] },
                    deleted: false,
                },
                data: { deleted: true, deleted_at: now },
            });
        } else {
            await prisma.user_mail.updateMany({
                where: { mail: { id: mail.id }, user_id: { not: user.id } },
                data: { last_edit: dates.getCurrentDate(), read: false },
            });
        }
        return successResponse({ res, body: createReply });
    } catch (error) {
        console.error(error);
        return errorResponse({
            res,
            message: {
                en: "Reply could not be created, server error",
                es: "No se ha podido responder al mensaje",
            },
            error: req.body.body,
        });
    } 
});

// *CHANGED* from /projects/1/emails/starred > to > /emails/projects/:id/starred
// STARR EMAIL //
router.put("/:id/starred", process.middlewares, async (req, res) => {
    try {
        const emailId = +req.params.id;
        if (!Number.isInteger(emailId)) {
            throw new Error("Missing integer id");
        }
        const { sub } = req.currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });
        if (!user) {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "User does not exists",
                    es: "No existe un usuario asociado",
                },
                error: "User does not exists",
            });
        }
        const query = `
    UPDATE user_mail SET starred = NOT(COALESCE(starred, FALSE)) WHERE id=${emailId};`;
        const update = await prisma.$executeRaw(query);
        return successResponse({ res, body: update });
    } catch (error) {
        return errorResponse({
            res,
            message: {
                en: "Email could not be starred",
                es: "No se pudo marcar el email",
            },
            error,
        });
    } 
});

// ARCHIVE EMAILS //
router.put("/archive", process.middlewares, async (req, res) => {
    try {
        const emails = req.body.emails;
        let query = `UPDATE user_mail SET archive = NOT(COALESCE(archive, FALSE)) 
    WHERE id IN (`;
        emails.forEach((email, index) => {
            query = query.concat(`${email}${!emails[index + 1] ? ")" : ","}`);
        });
        const update = await prisma.$executeRaw(query);
        return successResponse({ res, body: update });
    } catch (error) {
        return errorResponse({
            res,
            message: {
                en: "Email could not be starred",
                es: "No se pudo marcar el email",
            },
            error,
        });
    } 
});

// ARCHIVE EMAILS //
router.put("/:id/archive", process.middlewares, async (req, res) => {
    try {
        const emailId = +req.params.id;
        if (!Number.isInteger(emailId)) {
            throw new Error("Missing integer id");
        }
        const { sub } = req.currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });
        if (!user) {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "User does not exists",
                    es: "No existe un usuario asociado",
                },
                error: "User does not exists",
            });
        }
        const now = dates.getCurrentDate();
        const query = `
    UPDATE user_mail SET archive = NOT(COALESCE(archive, FALSE)),
    last_edit ='${now}' WHERE id=${emailId};`;
        const update = await prisma.$executeRaw(query);
        return successResponse({ res, body: update });
    } catch (error) {
        return errorResponse({
            res,
            message: {
                en: "Email could not be starred",
                es: "No se pudo marcar el email",
            },
            error,
        });
    } 
});

//MARK AS READ //
router.put("/:id/read", process.middlewares, async (req, res) => {
    try {
        const userEmailId = +req.params.id;
        if (!Number.isInteger(userEmailId)) {
            throw new Error("Missing integer id");
        }
        const { sub } = req.currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });
        if (!user) {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "User does not exists",
                    es: "No existe un usuario asociado",
                },
                error: "User does not exists",
            });
        }
        const update = await prisma.user_mail.update({
            where: { id: userEmailId },
            data: { read: true },
        });
        return successResponse({ res, body: update });
    } catch (error) {
        return errorResponse({
            res,
            message: {
                en: "Email could not be starred",
                es: "No se pudo marcar el email",
            },
            error: "Email could not be starred",
        });
    } 
});

// DELETE EMAIL (LOGICAL) //
router.put("/:id/delete", process.middlewares, async (req, res) => {
    try {
        const emailId = +req.params.id;
        if (!Number.isInteger(emailId)) {
            throw new Error("Id is not valid");
        }
        const now = dates.getCurrentDate();
        const deleted = await prisma.user_mail.update({
            where: { id: emailId },
            data: {
                deleted: true,
                last_edit: now,
                deleted_at: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Email deleted succesfully",
                es: "Se ha eliminado el email correctamente",
            },
            body: deleted,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({
            res,
            message: {
                en: "Email could not be delete",
                es: "No se pudo eliminar el email",
            },
            error: req.body,
        });
    } 
});

module.exports = router;
