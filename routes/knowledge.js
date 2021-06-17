const express = require("express");
const { getCurrentDate } = require("../helpers/dates");
const prisma = require("./db");
const { successResponse, errorResponse } = require("../helpers/apiResponser");
const router = express.Router();

// *CHANGED* /projects/:id/knowledge > to > /knowledge/project/:id //
// CREATE KNOWLEDGE BY PROJECT //
router.post("/projects/:id", process.middlewares, async (req, res) => {
    try {
        const project = await prisma.project.findUnique({
            where: { id: +req.params.id },
        });
        if (project && project.organization_id) {
            let createKnowledge = Object.assign({}, req.body);
            delete createKnowledge.project_id;
            delete createKnowledge.knowledge_category_id;
            createKnowledge.organization = {
                connect: { id: project.organization_id },
            };
            createKnowledge.project = {
                connect: { id: project.id },
            };
            createKnowledge.faq_category = {
                connect: { id: Number(req.body.knowledge_category_id) },
            };
            const knowledge = await prisma.faq.create({
                data: createKnowledge,
                include: { faq_category: true },
            });
            if (knowledge) {
                return successResponse({ res, body: knowledge });
            } else {
                return errorResponse({
                    res,
                    code: 400,
                    message: {
                        en: "Knowledge could not be created",
                        es: "No se ha podido crear el faq",
                    },
                    error: createKnowledge,
                });
            }
        } else {
            return errorResponse({ res, error: req.body });
        }
    } catch (error) {
        return errorResponse({
            res,
            message: {
                en: "Knowledge could not be created, server error",
                es: "No se ha podido crear el faq",
            },
            error: error,
        });
    } 
});

// GET KNOWLEDGE //
router.get("/:id", process.middlewares, async (req, res) => {
    try {
        const knowledgeId = +req.params.id;
        if (!Number.isInteger(knowledgeId)) throw new Error("Missing Event id");
        const knowledge = await prisma.faq.findUnique({
            where: { id: knowledgeId },
        });
        if (knowledge) {
            return successResponse({
                res,
                message: {
                    en: "Knowledge listed succesfully",
                    es: "Se han listado el faq correctamente",
                },
                body: knowledge,
            });
        } else {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "No knowledge registered",
                    es: "No hay un faq registrado con el id",
                },
                error: JSON.stringify("Error"),
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// UPDATE KNOWLEDGE //
router.put("/:id", process.middlewares, async (req, res) => {
    try {
        const knowledgeId = +req.params.id;
        if (!Number.isInteger(knowledgeId)) {
            throw new Error("Id is not valid");
        }
        let data = {};
        if (req.body) {
            data = req.body;
        }
        const now = getCurrentDate();
        data.last_edit = now;
        if (req.body.knowledge_category_id) {
            data.faq_category = {
                connect: { id: req.body.knowledge_category_id },
            };
        }
        delete data.id;
        delete data.knowledge_category_id;
        const updated = await prisma.faq.update({
            where: { id: knowledgeId },
            data,
        });
        return successResponse({
            res,
            message: {
                en: "Knowledge updated succesfully",
                es: "Se han actualizado el faq correctamente",
            },
            body: updated,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// *CHANGED* from /knowledge/:id/delete > to > /knowledge/delete/:id
// *CHANGED*
// DELETE KNOWLEDGE //
router.put("/:id/delete/", process.middlewares, async (req, res) => {
    try {
        const knowledgeId = +req.params.id;
        if (!Number.isInteger(knowledgeId)) {
            throw new Error("Id is not valid");
        }
        const now = getCurrentDate();
        const deleted = await prisma.faq.update({
            where: { id: knowledgeId },
            data: {
                deleted: true,
                last_edit: now,
                deleted_at: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Knowledge deleted succesfully",
                es: "Se ha eliminado el faq correctamente",
            },
            body: deleted,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// *CHANGED* from /knowledge/:id/publish > to > /knowledge/publish/:id
// PUBLISH KNOWLEDGE //
router.put("/:id/publish/", process.middlewares, async (req, res) => {
    try {
        const knowledgeId = +req.params.id;
        if (!Number.isInteger(knowledgeId)) {
            throw new Error("Id is not valid");
        }
        const now = getCurrentDate();
        const published = await prisma.faq.update({
            where: { id: knowledgeId },
            data: {
                published: true,
                posted_at: now,
                last_edit: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Knowledge posted succesfully",
                es: "Se ha publicado el faq correctamente",
            },
            body: published,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// *CHANGED* from /knowledge/1/duplicate > to > /knowledge/duplicate/1
// DUPLICATE KNOWLEDGE //
router.post("/duplicate/:id", process.middlewares, async (req, res) => {
    try {
        const knowledgeId = +req.params.id;
        if (!Number.isInteger(knowledgeId)) {
            throw new Error("Id is not valid");
        }
        const knowledge = await prisma.faq.findUnique({
            where: { id: knowledgeId },
        });
        if (!knowledge) {
            return errorResponse({
                res,
                statusCode: 404,

                message: {
                    en: "No knowledge registered with that id",
                    es: "No hay un registro con ese id",
                },
                error: JSON.stringify("Error"),
            });
        }
        let data = {};
        if (knowledge) {
            data = Object.assign({}, knowledge);
        }
        delete data.id;
        delete data.project_id;
        delete data.organization_id;
        delete data.knowledge_category_id;
        delete data.faq_category_id;
        data.project = {
            connect: { id: Number(knowledge.project_id) },
        };
        data.organization = {
            connect: { id: Number(knowledge.organization_id) },
        };
        data.faq_category = {
            connect: { id: Number(knowledge.faq_category_id) },
        };
        const duplicate = await prisma.faq.create({
            data,
        });
        if (duplicate) {
            return successResponse({
                res,
                message: {
                    en: "Knowledge duplicated succesfully",
                    es: "El faq se ha copiado exitosamente",
                },
                body: duplicate,
            });
        } else {
            return errorResponse({
                res,
                code: 400,
                message: {
                    en: "Recurso could not be duplicated",
                    es: "No se ha podido duplicar el faq",
                },
                error: data,
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// *CHANGE* from /knowledge/:id/unpublish > to > /knowledge/unpublish/:id
// UNPUBLISH KNOWLEDGE //
router.put("/:id/unpublish/", process.middlewares, async (req, res) => {
    try {
        const knowledgeId = +req.params.id;
        if (!Number.isInteger(knowledgeId)) {
            throw new Error("Knowledge Id is not valid");
        }
        const now = getCurrentDate();
        const published = await prisma.faq.update({
            where: { id: knowledgeId },
            data: {
                published: false,
                posted_at: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Knowledge unpublished succesfully",
                es: "Se ha despublicado el faq correctamente",
            },
            body: published,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// *CHANGED* from /projects/:id/knowledge > to > /knowledge/project/:id
// LIST PROJECT KNOWLEDGE //
router.get("/projects/:id", process.middlewares, async (req, res) => {
    try {
        const project_id = +req.params.id;
        if (!Number.isInteger(project_id)) throw new Error("Missing Event id");
        const knowledges = await prisma.faq.findMany({
            where: {
                deleted: !true,
                project_id: project_id,
            },
            orderBy: { created_at: "desc" },
            include: { faq_category: true },
        });
        return successResponse({
            res,
            message: {
                en: "Project knowledges listed succesfully",
                es: "Se han listado los faqs correctamente",
            },
            body: knowledges,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});
// *CHANGED* from projects/1/categories_and_knowledge > to > knowledge/projects/1/categories_and_knowledge
// LIST KNOWLEDGE AND CATEGORIES //
router.get(
    "/projects/:id/categories_and_knowledge",
    process.middlewares,
    async (req, res) => {
        try {
            const project_id = +req.params.id;
            if (!Number.isInteger(project_id))
                throw new Error("Missing Event id");
            const knowledge_categories = await prisma.faq_category.findMany({
                where: { project_id: project_id, deleted: !true },
                include: {
                    faq: {
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            content: true,
                            last_edit: true,
                            updated_at: true,
                            faq_category_id: true,
                        },
                        where: {
                            deleted: !true,
                        },
                    },
                },
            });
            const finalCategories = knowledge_categories.map((category) => {
                return Object.assign(Object.assign({}, category), {
                    posts: category.faq,
                });
            });
            return successResponse({
                res,
                message: {
                    en: "Knowledges caregories  listed succesfully",
                    es: "Se han listado las categorias de los faqs correctamente",
                },
                body: finalCategories,
            });
        } catch (error) {
            console.error(error);
            return errorResponse({ res, error });
        } finally {
            console.log("Close DB");
            
        }
    }
);

// *CHANGED* from /projects/:id/knowledge/category > to > /knowledge/project/:id/category
// ADD A NEW KNOWLEDGE CATEGORY //
router.post("/projects/:id/category", process.middlewares, async (req, res) => {
    const id = +req.params.id;
    if (!Number.isInteger(id)) {
        throw new Error("Knowledge Id is not valid");
    }
    try {
        const project = await prisma.project.findUnique({
            where: { id: id },
        });
        if (project && project.organization_id) {
            let data = Object.assign({}, req.body);
            delete data.project_id;
            data.project = { connect: { id: project.id } };
            data.organization = { connect: { id: project.organization_id } };
            const result = await prisma.faq_category.create({
                data,
            });
            return successResponse({ res, body: result });
        } else {
            return errorResponse({ res, error: "Invalid project id" });
        }
    } catch (error) {
        //More error management
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// possibly *CHANGED* from ? > to > /knowledge/project/:id/category
// LIST KNOWLEDGE CATEGORIES PER PROJECT //
router.get("/projects/:id/category", process.middlewares, async (req, res) => {
    try {
        const project_id = +req.params.id;
        if (!Number.isInteger(project_id)) {
            throw new Error("Knowledge Id is not valid");
        }
        const knowledge_categories = await prisma.faq_category.findMany({
            where: { project_id: project_id, deleted: !true },
        });
        return successResponse({
            res,
            message: {
                en: "Knowledges caregories  listed succesfully",
                es: "Se han listado las categorias de los faqs correctamente",
            },
            body: knowledge_categories,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// GET A CATEGORY BY ID //
router.get("/category/:id", process.middlewares, async (req, res) => {
    try {
        const id = +req.params.id;
        if (!Number.isInteger(id))
            throw new Error("Missing knowledge category id");
        const readCategory = await prisma.faq_category.findUnique({
            where: { id },
        });
        return successResponse({ res, body: readCategory });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

// UPDATE KNOWLEDGE CATEGORY //
router.put("/category/:id", process.middlewares, async (req, res) => {
    try {
        const id = +req.params.id;
        if (!Number.isInteger(id)) {
            throw new Error("Missing knowledge category integer id");
        }
        var data = Object.assign({}, req.body);
        const update = await prisma.faq_category.update({
            where: { id },
            data,
        });
        return successResponse({ res, body: update });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

module.exports = router;
