const express = require("express");
const prisma = require("./db");
const router = express.Router();
const dates = require("../helpers/dates");
const { successResponse, errorResponse } = require("../helpers/apiResponser");

router.post("/", async (req, res) => {
    try {
        let createNew = Object.assign({}, req.body);
        delete createNew.project_id;
        delete createNew.organization_id;
        createNew.project_news_project_idToproject = {
            connect: { id: Number(req.body.project_id) },
        };
        createNew.project_news_organization_idToproject = {
            connect: { id: Number(req.body.organization_id) },
        };
        const New = await prisma.news.create({
            data: createNew,
        });
        if (New) {
            return successResponse({ res, body: New });
        } else {
            return errorResponse({
                res,
                code: 400,
                message: {
                    en: "News could not be created",
                    es: "No se ha podido crear la noticia",
                },
                body: createNew,
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({
            res,
            message: {
                en: "News could not be created, server error",
                es: "No se ha podido crear la noticia",
            },
            error,
        });
    } 
});

// LIST ALL NEWS
router.get("/", process.middlewares, async (req, res) => {
    try {
        const news = await prisma.news.findMany({
            where: { deleted: !true },
        });
        if (news.length > 0) {
            return successResponse({
                res,
                message: {
                    en: "News listed succesfully",
                    es: "Se han listado las noticias correctamente",
                },
                body: news,
            });
        } else {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "No news registered",
                    es: "No hay noticias registradas",
                },
                error: JSON.stringify("Error"),
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// GET NEWS BY ID //
router.get("/:id", process.middlewares, async (req, res) => {
    try {
        const newsId = +req.params.id;
        if (!Number.isInteger(newsId)) throw new Error("Missing Event id");
        const news = await prisma.news.findUnique({
            where: { id: newsId },
        });
        if (news) {
            return successResponse({
                res,
                message: {
                    en: "News listed succesfully",
                    es: "Se han listado las noticias correctamente",
                },
                body: news,
            });
        } else {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "No news registered",
                    es: "No hay noticias registradas",
                },
                error: JSON.stringify("Error"),
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// UPDATE NEWS //
router.put("/:id", process.middlewares, async (req, res) => {
    try {
        const newsId = +req.params.id;
        if (!Number.isInteger(newsId)) {
            throw new Error("Id is not valid");
        }
        let data = {};
        if (req.body) {
            data = req.body;
        }
        const now = dates.getCurrentDate();
        data.last_edit = now;
        delete data.id;
        const updated = await prisma.news.update({
            where: { id: newsId },
            data,
        });
        return successResponse({
            res,
            message: {
                en: "News updated succesfully",
                es: "Se han actualizado las noticias correctamente",
            },
            body: updated,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// DELETE NEWS BY ID //
router.put("/:id/delete", process.middlewares, async (req, res) => {
    try {
        const newsId = +req.params.id;
        if (!Number.isInteger(newsId)) {
            throw new Error("Id is not valid");
        }
        const now = dates.getCurrentDate();
        const deleted = await prisma.news.update({
            where: { id: newsId },
            data: {
                deleted: true,
                last_edit: now,
                deleted_at: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "News deleted succesfully",
                es: "Se ha eliminado la noticia correctamente",
            },
            body: deleted,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});
// *CHANGE* from /news/:id/publish > to > /news/publish/:id
// PUBLISH NEWS //
router.put("/:id/publish/", process.middlewares, async (req, res) => {
    try {
        const newsId = +req.params.id;
        if (!Number.isInteger(newsId)) {
            throw new Error("Id is not valid");
        }
        const now = dates.getCurrentDate();
        const published = await prisma.news.update({
            where: { id: newsId },
            data: {
                published: true,
                posted_at: now,
                last_edit: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "News posted succesfully",
                es: "Se ha publicado la noticia correctamente",
            },
            body: published,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// *CHANGE* from /news/:id/duplicate > to > /news/duplicate/:id //
// DUPLICATE NEWS //
router.put("/:id/duplicate", process.middlewares, async (req, res) => {
    try {
        const newsId = +req.params.id;
        if (!Number.isInteger(newsId)) {
            throw new Error("Id is not valid");
        }
        const news = await prisma.news.findUnique({
            where: { id: newsId },
        });
        if (!news) {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "No news registered with that id",
                    es: "No hay noticias registradas con ese id",
                },
                error: JSON.stringify("Error"),
            });
        }
        let data = {};
        if (news) {
            data = Object.assign({}, news);
        }
        delete data.id;
        data.project_news_project_idToproject = {
            connect: { id: Number(data.project_id) },
        };
        data.project_news_organization_idToproject = {
            connect: { id: Number(data.organization_id) },
        };
        delete data.project_id;
        delete data.organization_id;
        const New = await prisma.news.create({
            data,
        });
        if (New) {
            return successResponse({
                res,
                message: {
                    en: "News duplicated succesfully",
                    es: "La noticia se ha copiado exitosamente",
                },
                body: New,
            });
        } else {
            return errorResponse({
                res,
                message: {
                    en: "News could not be duplicated",
                    es: "No se ha podido duplicar la noticia",
                },
                error: data,
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// *CHANGED* from /news/16/unpublish > to > /news/unpublish/16 //
// Unpublish news //
router.put("/:id/unpublish", process.middlewares, async (req, res) => {
    try {
        const newsId = +req.params.id;
        if (!Number.isInteger(newsId)) {
            throw new Error("News Id is not valid");
        }
        const now = dates.getCurrentDate();
        const published = await prisma.news.update({
            where: { id: newsId },
            data: {
                published: false,
                posted_at: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "News unpublished succesfully",
                es: "Se ha despublicado la noticia correctamente",
            },
            body: published,
        });
    } catch (error) {
        console.error(error);
        return successResponse({ res, error });
    } 
});

// *CHANGED* from /projects/:id/news > to > /news/projects/:id
// LIST NEW BY PROJECT //
router.get("/projects/:id", process.middlewares, async (req, res) => {
    try {
        const project_id = +req.params.id;
        const news = await prisma.news.findMany({
            where: {
                deleted: !true,
                project_id: project_id,
            },
            orderBy: { created_at: "desc" },
        });
        return successResponse({
            res,
            message: {
                en: "Project news listed succesfully",
                es: "Se han listado las noticias correctamente",
            },
            body: news,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

module.exports = router;
