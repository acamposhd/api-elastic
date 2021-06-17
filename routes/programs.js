const express = require("express");
const prisma = require("./db");
const router = express.Router();
const { getCurrentDate } = require("../helpers/dates");
const { successResponse, errorResponse } = require("../helpers/apiResponser");

router.post("/", process.middlewares, async (req, res) => {
    const { body } = req;
    try {
        let createProgram = Object.assign({}, body);
        delete createProgram.project_id;
        delete createProgram.organization_id;
        delete createProgram.program_category_id;
        createProgram.project_news_project_idToproject = {
            connect: { id: Number(body.project_id) },
        };
        createProgram.project_news_organization_idToproject = {
            connect: { id: Number(body.organization_id) },
        };
        createProgram.program_category = {
            connect: { id: Number(body.program_category_id) },
        };
        const program = await prisma.programs.create({
            data: createProgram,
        });

        return successResponse({
            res,
            body: program,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({
            res,
            message: {
                en: "Program could not be created, server error",
                es: "No se ha podido crear el programa",
            },
            error,
        });
    } 
});

router.get("/:id", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const programId = +params.id;
        if (!Number.isInteger(programId)) throw new Error("Missing id");
        const program = await prisma.programs.findUnique({
            where: { id: programId },
        });
        if (program) {
            return successResponse({
                res,
                message: {
                    en: "Program listed succesfully",
                    es: "Se han listado los programas correctamente",
                },
                body: program,
            });
        } else {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "No program registered",
                    es: "No hay un programa registrado con el id",
                },
                error: "Not found",
            });
        }
    } catch (error) {
        console.error(error);
        errorResponse({ res, error });
    } 
});

router.get("/projects/:id", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const project_id = +params.id;
        if (!Number.isInteger(project_id)) throw new Error("Missing id");
        const programs = await prisma.programs.findMany({
            where: {
                deleted: !true,
                project_id: project_id,
            },
            orderBy: { created_at: "desc" },
        });
        return successResponse({
            res,
            message: {
                en: "Project programs listed succesfully",
                es: "Se han listado los programas correctamente",
            },
            body: programs,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

router.put("/:id", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const programId = +params.id;
        if (!Number.isInteger(programId)) {
            throw new Error("Id is not valid");
        }
        let data = {};
        if (body) {
            data = body;
        }
        delete data.id;
        const now = getCurrentDate();
        data.last_edit = now;
        const updated = await prisma.programs.update({
            where: { id: programId },
            data,
        });
        return successResponse({
            res,
            message: {
                en: "Program updated succesfully",
                es: "Se han actualizado los programas correctamente",
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
        const programId = +params.id;
        if (!Number.isInteger(programId)) {
            throw new Error("Id is not valid");
        }
        const now = getCurrentDate();
        const deleted = await prisma.programs.update({
            where: { id: programId },
            data: {
                deleted: true,
                last_edit: now,
                deleted_at: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Program deleted succesfully",
                es: "Se ha eliminado el programa correctamente",
            },
            body: deleted,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

router.put("/:id/publish", async (req, res) => {
    const { params } = req;
    try {
        const programId = +params.id;
        if (!Number.isInteger(programId)) {
            throw new Error("Id is not valid");
        }
        const now = getCurrentDate();
        const published = await prisma.programs.update({
            where: { id: programId },
            data: {
                published: true,
                posted_at: now,
                last_edit: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Program posted succesfully",
                es: "Se ha publicado el programa correctamente",
            },
            body: published,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});

router.put("/:id/unpublish", async (req, res) => {
    const { params } = req;
    try {
        const programId = +params.id;
        if (!Number.isInteger(programId)) {
            throw new Error("Program Id is not valid");
        }
        const published = await prisma.programs.update({
            where: { id: programId },
            data: {
                published: false,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Program unpublished succesfully",
                es: "Se ha despublicado el programa correctamente",
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
        const programId = +params.id;

        if (!Number.isInteger(programId)) {
            throw new Error("Id is not valid");
        }
        const program = await prisma.programs.findUnique({
            where: { id: programId },
        });
        if (!program) {
            return errorResponse({
                res,
                error: "No programs registered with that id",
                code: 404,
                message: {
                    en: "No programs registered with that id",
                    es: "No hay un registro registrado con ese id",
                },
            });
        }
        let data = {};
        if (program) {
            data = Object.assign({}, program);
        }
        delete data.id;
        delete data.project_id;
        delete data.organization_id;
        data.project_programs_project_idToproject = {
            connect: { id: Number(program.project_id) },
        };
        data.project_programs_organization_idToproject = {
            connect: { id: Number(program.organization_id) },
        };
        const duplicate = await prisma.programs.create({
            data,
        });

        return successResponse({
            res,
            message: {
                en: "Program duplicated succesfully",
                es: "El programa se ha copiado exitosamente",
            },
            body: duplicate,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } 
});
module.exports = router;
