const express = require("express");
const prisma = require("./db");
const router = express.Router();
const { getCurrentDate } = require("../helpers/dates");
const { successResponse, errorResponse } = require("../helpers/apiResponser");

router.post("/projects/:id", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id)) {
            throw new Error("Id is not valid");
        }
        const project = await prisma.project.findUnique({
            where: { id: id },
        });
        if (project && project.organization_id) {
            let createResource = Object.assign({}, body);
            delete createResource.project_id;
            delete createResource.resource_category_id;
            delete createResource.organization_id;
            createResource.project_projectToresources_organization_id = {
                connect: { id: project.organization_id },
            };
            createResource.project_projectToresources_project_id = {
                connect: { id: project.id },
            };
            createResource.resource_category = {
                connect: { id: Number(body.resource_category_id) },
            };
            const resource = await prisma.resources.create({
                data: createResource,
                include: { resource_category: true },
            });
            if (resource) {
                return successResponse({ res, body: resource });
            } else {
                return errorResponse({
                    res,
                    message: {
                        en: "Resource could not be created",
                        es: "No se ha podido crear el recurso",
                    },
                    error: createResource,
                });
            }
        } else {
            return errorResponse({
                res,
                code: 400,
                error: "Invalid project id",
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({
            res,
            message: {
                en: "Resource could not be created, server error",
                es: "No se ha podido crear el recurso",
            },
            error: body,
        });
    } 
});

router.get("/projects/:id", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const project_id = +params.id;
        if (!Number.isInteger(project_id)) {
            throw new Error("Id is not valid");
        }
        const resources = await prisma.resources.findMany({
            where: {
                deleted: !true,
                project_id: project_id,
            },
            orderBy: { created_at: "desc" },
            include: { resource_category: true },
        });
        return successResponse({
            res,
            message: {
                en: "Project resources listed succesfully",
                es: "Se han listado los recursos correctamente",
            },
            body: resources,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

//Route modified
router.get(
    "/my/projects/:project_id",
    process.middlewares,
    async (req, res) => {
        const { body, params } = req;
        try {
            const cognito = req.currentUser.sub;
            const user = await prisma.user.findUnique({
                where: { cognito_sub: cognito },
            });
            const { project_id } = params;
            const resources = await prisma.user_resource.findMany({
                where: {
                    deleted: !true,
                    project_id: project_id,
                    user_id: user.id,
                },
                orderBy: { created_at: "desc" },
                include: {
                    resources: {
                        select: {
                            title: true,
                            description: true,
                            image: true,
                            website_link: true,
                            more_websites: true,
                        },
                    },
                },
            });
            return successResponse({
                res,
                message: {
                    en: "Project user resources listed succesfully",
                    es: "Se han listado los recursos del usuario correctamente",
                },
                body: resources,
            });
        } catch (error) {
            console.error(error);
            return errorResponse({ res, error });
        } finally {
            
        }
    }
);

router.put("/:id", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const resourceId = +params.id;
        if (!Number.isInteger(resourceId)) {
            throw new Error("Id is not valid");
        }
        let data = {};
        if (body) {
            data = body;
        }
        const now = getCurrentDate();
        data.last_edit = now;
        if (body.resource_category_id) {
            data.resource_category = {
                connect: { id: body.resource_category_id },
            };
        }
        delete data.id;
        delete data.resource_category_id;
        const updated = await prisma.resources.update({
            where: { id: resourceId },
            data,
        });
        return successResponse({
            res,
            message: {
                en: "Resource updated succesfully",
                es: "Se han actualizado los recursos correctamente",
            },
            body: updated,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

router.put("/:id/delete", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const resourceId = +params.id;
        if (!Number.isInteger(resourceId)) {
            throw new Error("Id is not valid");
        }
        const now = getCurrentDate();
        const deleted = await prisma.resources.update({
            where: { id: resourceId },
            data: {
                deleted: true,
                last_edit: now,
                deleted_at: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Resource deleted succesfully",
                es: "Se ha eliminado el recurso correctamente",
            },
            body: deleted,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

router.get("/:id", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const resourceId = +params.id;
        if (!Number.isInteger(resourceId)) {
            throw new Error("Id is not valid");
        }
        const resource = await prisma.resources.findUnique({
            where: { id: resourceId },
        });
        if (resource) {
            return successResponse({
                res,
                message: {
                    en: "Resource listed succesfully",
                    es: "Se han listado los recursos correctamente",
                },
                body: resource,
            });
        } else {
            return errorResponse({
                res,
                message: {
                    en: "No resource registered",
                    es: "No hay un recurso registrado con el id",
                },
                error: "No resource registered",
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

router.put("/:id/publish", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const resourceId = +params.id;
        if (!Number.isInteger(resourceId)) {
            throw new Error("Id is not valid");
        }
        const now = getCurrentDate();
        const published = await prisma.resources.update({
            where: { id: resourceId },
            data: {
                published: true,
                posted_at: now,
                last_edit: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Resource posted succesfully",
                es: "Se ha publicado el recurso correctamente",
            },
            body: published,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

router.put("/:id/unpublish", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const resourceId = +params.id;
        if (!Number.isInteger(resourceId)) {
            throw new Error("Resource Id is not valid");
        }
        const now = getCurrentDate();
        const published = await prisma.resources.update({
            where: { id: resourceId },
            data: {
                published: false,
                posted_at: now,
                last_edit: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Resource unpublished succesfully",
                es: "Se ha despublicado el recurso correctamente",
            },
            body: published,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

router.put("/:id/duplicate", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const resourceId = +params.id;
        if (!Number.isInteger(resourceId)) {
            throw new Error("Id is not valid");
        }
        const resource = await prisma.resources.findUnique({
            where: { id: resourceId },
        });
        if (!resource) {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "No resources registered with that id",
                    es: "No hay un registro registrado con ese id",
                },
                error: "No resources registered with that id",
            });
        }
        let data = {};
        if (resource) {
            data = Object.assign({}, resource);
        }
        delete data.id;
        delete data.project_id;
        delete data.organization_id;
        delete data.resource_category_id;
        data.project_projectToresources_project_id = {
            connect: { id: Number(resource.project_id) },
        };
        data.project_projectToresources_organization_id = {
            connect: { id: Number(resource.organization_id) },
        };
        data.resource_category = {
            connect: { id: Number(resource.resource_category_id) },
        };
        const duplicate = await prisma.resources.create({
            data,
        });
        if (duplicate) {
            return successResponse({
                res,
                message: {
                    en: "Resource duplicated succesfully",
                    es: "El recurso se ha copiado exitosamente",
                },
                body: duplicate,
            });
        } else {
            return {
                res,
                code: 400,
                message: {
                    en: "Recurso could not be duplicated",
                    es: "No se ha podido duplicar el recurso",
                },
                error: data,
            };
        }
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

router.get(
    "/categories/projects/:pid",
    process.middlewares,
    async (req, res) => {
        const { params } = req;
        try {
            const project_id = +params.pid;
            if (!Number.isInteger(project_id)) {
                throw new Error("Id is not valid");
            }
            const resource_categories = await prisma.resource_category.findMany(
                {
                    where: { project_id: project_id, deleted: !true },
                }
            );
            return successResponse({
                res,
                message: {
                    en: "Resources caregories  listed succesfully",
                    es: "Se han listado las categorias de los recursos correctamente",
                },
                body: resource_categories,
            });
        } catch (error) {
            console.error(error);
            return errorResponse({ res, error });
        } finally {
            console.log("Close DB");
            
        }
    }
);

router.post(
    "/categories/projects/:pid",
    process.middlewares,
    async (req, res) => {
        const { params, body } = req;
        try {
            const project_id = +params.pid;
            if (!Number.isInteger(project_id)) {
                throw new Error("Id is not valid");
            }
            const project = await prisma.project.findUnique({
                where: { id: project_id },
            });
            if (project && project.organization_id) {
                let data = Object.assign({}, body);
                delete data.project_id;
                data.project_projectToresource_category_project_id = {
                    connect: { id: project.id },
                };
                data.project_projectToresource_category_organization_id = {
                    connect: { id: project.organization_id },
                };
                const result = await prisma.resource_category.create({
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
        } finally {
            
        }
    }
);

router.get("/category/:id", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id))
            return errorResponse({
                res,
                error: "Missing resource category id",
            });

        const readCategory = await prisma.resource_category.findUnique({
            where: { id },
        });

        return successResponse({ res, body: readCategory });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

router.put("/category/:id", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id)) {
            return errorResponse({
                res,
                error: "Missing resource category id",
            });
        }
        var data = Object.assign({}, body.data);
        const update = await prisma.resource_category.update({
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
