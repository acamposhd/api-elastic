const express = require("express");
const prisma = require("./db");
const router = express.Router();
const dates = require("../helpers/dates");
const { successResponse, errorResponse } = require("../helpers/apiResponser");

// *CHANGED* from /report > to > /reports/
// GET ALL REPORTS //
router.get("/", process.middlewares, async (req, res) => {
    try {
        let params = {};
        params.take = req.body.offset || 100;
        params.include = {
            user_report_assigned_toTouser: true,
            user_report_reported_byTouser: true,
            typename: { include: { typename_category: true } },
            department: true,
        };
        params.where = { deleted: !true, project_id: 1 };
        params.orderBy = { created_at: "desc" };
        if (req.body.from) {
            params.cursor = req.body.from;
        }
        const reports = await prisma.report.findMany(params);
        if (reports.length > 0) {
            return successResponse({
                res,
                message: {
                    en: "Reports listed succesfully",
                    es: "Se han listado los reportes correctamente",
                },
                body: reports,
            });
        } else {
            return errorResponse({
                res,
                message: {
                    en: "No reports registered",
                    es: "No hay reportes registrados",
                },
                error: "Error",
                code: 404,
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

// *CHANGED* from /projects/36/report?app=true > to > /reports/projects/:id (project id)
// GET REPORTS BY PROJECT ID //
router.get("/projects/:id", process.middlewares, async (req, res) => {
    try {
        const id = +req.params.id;
        const { app } = req.params;
        const { states, typenames } = req.body;
        if (!Number.isInteger(id)) throw new Error("Missing project id");
        let params = {};
        params.take = req.body.offset || 50;
        params.include = {
            user_report_assigned_toTouser: true,
            user_report_reported_byTouser: true,
            typename: { include: { typename_category: true } },
            department: true,
        };
        let where = { deleted: !true, project_id: id };
        params.orderBy = { created_at: "desc" };
        if (req.body.from) {
            params.cursor = req.from;
        }
        if (app) {
            where.AND = [{ status: "open" }, { public: true }];
        }
        if (states?.length > 0) {
            where.status = { in: states };
        }
        if (typenames?.length > 0) {
            where.typename = { in: typenames };
        }
        if (req.body.start_date && req.body.end_date) {
            where.created_at = {
                gte: req.body.start_date,
                lte: req.body.end_date,
            };
        }
        params.where = where;
        const reports = await prisma.report.findMany(params);
        return successResponse({
            res,
            message: {
                en: "Reports listed succesfully",
                es: "Se han listado los reportes correctamente",
            },
            body: reports,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

// *CHANGED* from /projects/1/citizen/report > to > reports/projects/:id/citizen (project id)
// GET REPORTS BY PROJECT ID AND USER //
router.get("/projects/:id/citizen", process.middlewares, async (req, res) => {
    try {
        const cognito = req.currentUser.sub;
        const project_id = +req.params.id;
        if (!Number.isInteger(project_id)) {
            throw new Error("Missing project integer id");
        }
        const user = await prisma.user.findUnique({
            where: { cognito_sub: cognito },
        });
        if (!user) {
            throw new Error("User not found");
        }
        console.log({ user });
        let params = {};
        params.take = req.body.offset || 100;
        params.include = {
            user_report_assigned_toTouser: true,
            user_report_reported_byTouser: true,
            typename: { include: { typename_category: true } },
            department: true,
        };
        params.where = {
            deleted: !true,
            user_report_reported_byTouser: { id: user.id },
            project: { id: project_id },
        };
        params.orderBy = { created_at: "desc" };
        if (req.body.from) {
            params.cursor = req.body.from;
        }
        const reports = await prisma.report.findMany(params);
        return successResponse({
            res,
            message: {
                en: "User Reports listed succesfully",
                es: "Se han listado los reportes del usuario",
            },
            body: reports,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

//                                       <--ATTENTION-->
// This route is not with the other category routes due to a bug caused by the way express handles routes
// The route directly below this one GET reports/:id wrongly gets matched to calls for the this route.
// If this route is moved it will break.
//                                       <------------->
// LIST ALL CATEGORIES //
router.get("/categories", process.middlewares, async (req, res) => {
    try {
        const categories = await prisma.typename_category.findMany({
            where: {
                deleted: !true,
                project_id: 1,
            },
        });
        if (categories.length > 0) {
            return successResponse({
                res,
                message: {
                    en: "Typename Categories listed succesfully",
                    es: "Se han listado las categorias correctamente",
                },
                body: categories,
            });
        } else {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "No typenames categories registered",
                    es: "No hay categorias registradas",
                },
                error: JSON.stringify("Error"),
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({
            res,
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(error),
        });
    } finally {
        await prisma.$disconnect();
    }
});

// *CHANGED* from /report/1 > to > /reports/:id
// GET REPORT BY ID //
router.get("/:id", process.middlewares, async (req, res) => {
    try {
        const id = +req.params.id;
        if (!Number.isInteger(id)) throw new Error("Missing report id");
        const report = await prisma.report.findUnique({
            where: { id: id },
            include: {
                user_report_assigned_toTouser: true,
                user_report_reported_byTouser: true,
                typename: { include: { typename_category: true } },
                department: true,
            },
        });

        return successResponse({ res, body: report });
    } catch (error) {
        console.log("Error reading a report :", error);
        return errorResponse({
            res,
            message: {
                en: "Report  could not be read, server error",
                es: "No se ha podido leer el reporte",
            },
            error,
        });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

// *CHANGED* from /report > to > /reports
// CREATE REPORTS //
router.post("/", process.middlewares, async (req, res) => {
    try {
        const flag = req.body.flag;
        const location = `point(${flag.latitude},${flag.longitude})`;
        let columns = `formatted_address, zipcode, description, source, efields, status,
                    latitude, longitude, organization_id, project_id, location`;

        const efields = flag.efields ? JSON.stringify(flag.efields) : "[]";
        let values = `'${flag.address}','${flag.zipcode}','${flag.description}','${flag.source}',
        '${efields}','pending',${flag.latitude}, ${flag.longitude}, ${flag.organization_id},
        ${flag.project_id},${location}`;

        if (flag.typename_id) {
            columns += `, typename_id`;
            values += `,${flag.typename_id}`;
        } else {
            columns += `, something, type`;
            values += `,'${flag.something}','${flag.type}'`;
        }
        if (flag.image) {
            columns += `, image`;
            values += `,'${flag.image}'`;
        }
        if (flag.images) {
            columns += `, images`;
            values += `, '{${flag.images}}'`;
        }
        if (flag.status) {
            columns += `, status`;
            values += `,'${flag.status}'`;
        }
        if (flag.priority) {
            columns += `, priority`;
            values += `,'${flag.priority}'`;
        }
        if (flag.resident) {
            columns += `, resident`;
            values += `,'${flag.resident}'`;
        }
        if (flag.show) {
            columns += `, public`;
            values += `,'${flag.show}'`;
        }
        if (flag.reported_by) {
            columns += `, reported_by`;
            values += `,${flag.reported_by}`;
        }
        //Flow when source is chatbot
        if (flag.source === "chatbot") {
            // TO DO: CHATBOT FLOW
        } else {
            // columns += `, reported_by`;
            // values += `,${flag.reported_by}`;
        }
        const createdReport = await prisma.$executeRaw(`
        INSERT INTO report (${columns})
        VALUES (${values})
        RETURNING *;`);

        return successResponse({ res, body: createdReport });
    } catch (error) {
        //More error management
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

// *CHANGED* from /report/widget > to > reports/widget
// CREATE WIDGET REPORT //
router.post("/widget", process.middlewares, async (req, res) => {
    try {
        let flag = req.body.flag;
        const location = `point(${flag.latitude},${flag.longitude})`;
        let columns = `formatted_address, zipcode, description, source, efields, status,
                  latitude, longitude, organization_id, project_id, location`;
        const efields = flag.efields ? JSON.stringify(flag.efields) : "[]";
        let values = `'${flag.address}','${flag.zipcode}','${flag.description}','${flag.source}',
    '${efields}','pending',${flag.latitude}, ${flag.longitude}, ${flag.organization_id},
    ${flag.project_id},${location}`;
        if (flag.typename_id) {
            columns += `, typename_id`;
            values += `,${flag.typename_id}`;
        } else {
            columns += `, something, type`;
            values += `,'${flag.something}','${flag.type}'`;
        }
        if (flag.image) {
            columns += `, image`;
            values += `,'${flag.image}'`;
        }
        if (flag.images) {
            console.log(flag.images);
            columns += `, images`;
            values += `, '{${flag.images}}'`;
        }
        if (flag.status) {
            columns += `, status`;
            values += `,'${flag.status}'`;
        }
        if (flag.priority) {
            columns += `, priority`;
            values += `,'${flag.priority}'`;
        }
        if (flag.resident) {
            columns += `, resident`;
            values += `,'${flag.resident}'`;
        }
        // columns += `, reported_by`
        // values += `,${flag.reported_by}`
        const createdReport = await prisma.$executeRaw(`
      INSERT INTO report (${columns})
      VALUES (${values})
      RETURNING *;`);
        return successResponse({ res, body: createdReport });
    } catch (error) {
        //More error management
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

// *CHANGED* from /report/1 > to > /reports/:id
// UPDATE REPORT //
router.put("/:id", process.middlewares, async (req, res) => {
    try {
        const reportId = +req.params.id;
        if (!Number.isInteger(reportId)) {
            throw new Error("Missing report integer id");
        }
        let data = Object.assign(
            { last_edit: dates.getCurrentDate() },
            req.body
        );
        const update = await prisma.report.update({
            where: { id: reportId },
            data,
        });
        if (data.longitude && data.latitude) {
            await prisma.$executeRaw`UPDATE report SET location = point(${data.longitude}, ${data.latitude}) WHERE id = ${reportId} RETURNING *;`;
        }
        return successResponse({ res, body: update });
    } catch (error) {
        //More error management
        return errorResponse({
            res,
            message: {
                en: "Report  could not be updated, server error",
                es: "No se ha podido actualizar el reporte",
            },
            error,
        });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

// *CHANGED* from /report/1/approve > to > /reports/:id/approve
//APPROVE REPORT //
router.put("/:id/approve", process.middlewares, async (req, res) => {
    try {
        const reportId = +req.params.id;
        if (!Number.isInteger(reportId)) {
            throw new Error("Missing report integer id");
        }
        let data = {
            last_edit: dates.getCurrentDate(),
        };
        const assignationData = req.body;
        if (assignationData.assigned_user_id) {
            (data.user_report_assigned_toTouser = {
                connect: { id: assignationData.assigned_user_id },
            }),
                (data.assigned_at = dates.getCurrentDate());
            data.department = {
                connect: { id: assignationData.department_id },
            };
            data.priority = assignationData.priority;
            data.due_date = assignationData.due_date;
            data.status = "open";
        } else {
            return errorResponse({
                res,
                message: {
                    en: "Report  could not be approved, server error",
                    es: "No se ha podido aprobar el flag",
                },
                error: "Missing required data",
            });
            return;
        }
        if (assignationData.show_in_app) {
            data.public = assignationData.show_in_app;
        }
        const update = await prisma.report.update({
            where: { id: reportId },
            data,
        });
        return successResponse({ res, body: update });
    } catch (error) {
        console.log(error);
        return errorResponse({
            res,
            message: {
                en: "Report  could not be approved, server error",
                es: "No se ha podido aprobar el flag",
            },
            error,
        });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

// *CHANGED* from /report/1/show > to > /reports/:id/show
// SHOW REPORT IN APP //
router.put("/:id/show", process.middlewares, async (req, res) => {
    try {
        const reportId = +req.params.id;
        const { show_in_app } = req.body;
        if (!Number.isInteger(reportId)) {
            throw new Error("Missing report integer id");
        }
        let data = {
            last_edit: dates.getCurrentDate(),
            public: show_in_app,
            status: "open",
        };
        const update = await prisma.report.update({
            where: { id: reportId },
            data,
        });
        return successResponse({ res, body: update });
    } catch (error) {
        console.log(error);
        return errorResponse({
            res,
            message: {
                en: "Report could not be updated, server error",
                es: "No se ha podido editar el report",
            },
            error,
        });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

// *CHANGED* from /report/1/reject > to > /reports/:id/reject
// REJECT REPORT //
router.put("/:id/reject", process.middlewares, async (req, res) => {
    try {
        const reportId = +req.params.id;
        if (!Number.isInteger(reportId)) {
            throw new Error("Missing report integer id");
        }
        const now = dates.getCurrentDate();
        let data = Object.assign(
            {
                last_edit: now,
                status: "rejected",
                public: false,
                reject_at: now,
            },
            req.body
        );
        const update = await prisma.report.update({
            where: { id: reportId },
            data,
        });
        return successResponse({ res, body: update });
    } catch (error) {
        console.log(error);
        return errorResponse({
            res,
            message: {
                en: "Report  could not be rejected, server error",
                es: "No se ha podido rechazar el flag",
            },
            error,
        });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

// *CHANGED* from /report/1/delete > to > /reports/:id/delete
// DELETE REPORT (LOGICAL DELETION) //
router.put("/:id/delete", process.middlewares, async (req, res) => {
    try {
        const reportId = +req.params.id;
        if (!Number.isInteger(reportId)) {
            throw new Error("Missing report integer id");
        }
        const now = dates.getCurrentDate();
        let data = {
            last_edit: now,
            deleted: true,
            deleted_at: now,
        };
        const update = await prisma.report.update({
            where: { id: reportId },
            data,
        });
        return successResponse({ res, body: update });
    } catch (error) {
        console.log(error);
        return errorResponse({
            res,
            message: {
                en: "Report could not be deleted, server error",
                es: "No se ha podido eliminar el flag",
            },
            error,
        });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

// Delete report (physical) //
router.delete("/:id", process.middlewares, async (req, res) => {
    try {
        const reportId = +req.params.id;
        if (!Number.isInteger(reportId)) {
            throw new Error("Missing integer id");
        }
        const deletion = await prisma.report.delete({
            where: { id: reportId },
        });
        return successResponse({ res, body: deletion });
    } catch (error) {
        //More error management
        return errorResponse({
            res,
            message: {
                en: "Report could not be deleted, server error",
                es: "No se ha podido eliminar el flag",
            },
            error,
        });
    } finally {
        console.log("Close DB");
        await prisma.$disconnect();
    }
});

/**
 * CATEGORIES SERVICE
 * *CHANGED* This used to be its own service but now it is part of the reports ( flags ) service.
 * The name of this service was typereports. It really only provides access to managing the categories
 * of reports ( flags ).
 *
 * The list categories route is not located in this section. It is above the GET /reports/:id
 * This is due to a bug.
 *
 */

// CREATE A CATEGORY FOR A FLAG //
router.post(
    "/projects/:id/categories",
    process.middlewares,
    async (req, res) => {
        try {
            let data = Object.assign({}, req.body);
            let { subcategories } = req.body;
            delete data.project_id;
            delete data.organization_id;
            delete data.subcategories;
            data.project = { connect: { id: +req.params.id } };
            data.organization = { connect: { id: +req.body.organization_id } };
            let createdCategory = await prisma.typename_category.create({
                data,
            });
            if (subcategories.length >= 0) {
                subcategories.forEach((subcategory) => {
                    subcategory.category_id = createdCategory.id;
                    if (!subcategory.color) {
                        subcategory.color = "#000000";
                    }
                });
                await prisma.typename.createMany({
                    data: subcategories,
                    skipDuplicates: true,
                });
                const createdSubcategories = await prisma.typename.findMany({
                    where: { category_id: createdCategory.id },
                    select: { id: true, name: true },
                });
                createdCategory.typenames = createdSubcategories;
            }
            return successResponse({
                res,
                message: {
                    en: "Typename category created succesfully",
                    es: "Se creó la categoria",
                },
                body: createdCategory,
            });
        } catch (error) {
            console.error("Error: ", error);
            return errorResponse({
                res,
                message: {
                    en: "Typename Category could not be created, server error",
                    es: "No se ha podido crear la categoria",
                },
                error: req.body,
            });
        } finally {
            await prisma.$disconnect();
        }
    }
);

// ACCESS A CATEGORY FROM FLAG //
router.get("/categories/:id", process.middlewares, async (req, res) => {
    try {
        const categoryId = +req.params.id;
        if (!Number.isInteger(categoryId)) {
            throw new Error("Missing integer id");
        }
        const category = await prisma.typename_category.findUnique({
            where: { id: categoryId },
        });
        if (category) {
            return successResponse({
                res,
                message: {
                    en: "Category listed succesfully",
                    es: "Se han listado las categoria correctamente",
                },
                body: category,
            });
        } else {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "No category registered",
                    es: "No hay una categoria con ese id registrado",
                },
                error: JSON.stringify("Error"),
            });
        }
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        await prisma.$disconnect();
    }
});

// UPDATE A CATEGORY ON A FLAG //
router.put("/categories/:id", process.middlewares, async (req, res) => {
    try {
        let { subcategories } = req.body;
        const category_id = +req.params.id;
        if (!Number.isInteger(category_id)) {
            throw new Error("Missing integer id");
        }
        let data = Object.assign({}, req.body);
        delete data.id;
        delete data.subcategories;
        let updatedCategory = await prisma.typename_category.update({
            data,
            where: { id: category_id },
        });
        if (subcategories.length >= 0) {
            subcategories.forEach((subcategory) => {
                subcategory.project_id = updatedCategory.project_id;
                subcategory.organization_id = updatedCategory.organization_id;
                if (!subcategory.color) {
                    subcategory.color = "#000000";
                }
            });
            if (subcategories.length > 0) {
                subcategories[0].category_id = category_id;
            }
            await prisma.typename.createMany({
                data: subcategories,
                skipDuplicates: true,
            });
            const createdSubcategories = await prisma.typename.findMany({
                where: { category_id: updatedCategory.id, deleted: !true },
                select: { id: true, name: true },
            });
            updatedCategory.typenames = createdSubcategories;
        }
        return successResponse({
            res,
            body: updatedCategory,
        });
    } catch (error) {
        console.error("Error: ", error);
        return errorResponse({ res, error });
    } finally {
        await prisma.$disconnect();
    }
});

// LIST ALL CATEGORIES IN PROJECT //
router.get(
    "/projects/:id/categories",
    process.middlewares,
    async (req, res) => {
        try {
            const project_id = +req.params.id;
            if (!Number.isInteger(project_id)) {
                throw new Error("Missing integer id");
            }
            let params = {
                where: {
                    deleted: !true,
                    project_id: project_id,
                },
                orderBy: { created_at: "asc" },
            };
            if (req.query.subcategories) {
                params.select = {
                    id: true,
                    name: true,
                    image: true,
                    typename: {
                        select: {
                            id: true,
                            name: true,
                        },
                        where: { deleted: !true },
                    },
                };
            }
            const categories = await prisma.typename_category.findMany(params);
            return successResponse({
                res,
                message: {
                    en: "Project Typename Categories listed succesfully",
                    es: "Se han listado las categorias del proyecto correctamente",
                },
                body: categories,
            });
        } catch (error) {
            console.error(error);
            return errorResponse({ res, error });
        } finally {
            await prisma.$disconnect();
        }
    }
);

// *CHANGED* from /category/:id/typenames > to > /reports/categories/:id/typenames
// TYPEREPORTS PER CATEGORY //
router.get(
    "/categories/:id/typenames",
    process.middlewares,
    async (req, res) => {
        try {
            const category_id = +req.params.id;
            if (!Number.isInteger(category_id)) {
                throw new Error("Missing category id");
            }
            const typereports = await prisma.typename.findMany({
                where: { deleted: !true, category_id: category_id },
            });
            return successResponse({
                res,
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                message: {
                    en: "Typenames retrieved succesfully",
                    es: "Se encontraron typenames para la categoria",
                },
                body: typereports,
            });
        } catch (error) {
            //More error management
            console.error("Error: ", error);
            return errorResponse({
                res,
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                message: {
                    en: "Category typenames could not retrieve, server error",
                    es: "No se han podido consultar los typename de la categoria",
                },
                body: error,
            });
        } finally {
            await prisma.$disconnect();
        }
    }
);

// *CHANGED* from /category/:id/delete > to > /reports/categories/:id/delete
// LOGICAL DELETE //
// DELETE A CATEGORY //
router.put("/categories/:id/delete", process.middlewares, async (req, res) => {
    try {
        const categoryId = +req.params.id;
        if (!Number.isInteger(categoryId)) {
            throw new Error("Id is not valid");
        }
        const now = dates.getCurrentDate();
        const deleted = await prisma.typename_category.update({
            where: { id: categoryId },
            data: {
                deleted: true,
                deleted_at: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Category deleted succesfully",
                es: "Se ha eliminado la categoria correctamente",
            },
            body: deleted,
        });
    } catch (error) {
        console.error(error);
        return errorResponse({ res, error });
    } finally {
        await prisma.$disconnect();
    }
});

// *CHANGED* from /projects/1/typereports > to > /reports/projects/1/typereports
// CREATE PROJECT TYPE REPORT //
router.post(
    "/projects/:id/typereports",
    process.middlewares,
    async (req, res) => {
        try {
            const project_id = +req.params.id;
            if (!Number.isInteger(project_id)) {
                throw new Error("Missing project integer id");
            }
            let data = Object.assign({}, req.body);
            delete data.project_id;
            delete data.organization_id;
            delete data.category_id;
            data.typename_category = { connect: { id: req.body.category_id } };
            data.organization = { connect: { id: req.body.organization_id } };
            data.project = { connect: { id: project_id } };
            if (data.color === undefined) {
                data.color = "#000000";
            }
            const createdTypereport = await prisma.typename.create({
                data,
            });
            return successResponse({ res, body: createdTypereport });
        } catch (error) {
            console.error("Error: ", error);
            return errorResponse({ res, error });
        } finally {
            await prisma.$disconnect();
        }
    }
);

// *CHANGED* from /typereports/:id > to > /reports/typereports/:id
// ACCESS TYPE REPORT //
router.get("/typereports/:id", process.middlewares, async (req, res) => {
    try {
        const typereportId = +req.params.id;
        if (!Number.isInteger(typereportId)) {
            throw new Error("Missing project integer id");
        }
        const typereport = await prisma.typename.findUnique({
            where: { id: typereportId },
        });
        if (typereport) {
            return successResponse({
                res,
                message: {
                    en: "Typereport listed succesfully",
                    es: "Se ha encontrado la subcategoria correctamente",
                },
                body: typereport,
            });
        } else {
            return errorResponse({
                res,
                code: 404,
                message: {
                    en: "No Typereport registered",
                    es: "No hay una subcategoria con ese id registrado",
                },
                error: JSON.stringify("Error"),
            });
        }
    } catch (error) {
        console.error(error);
        errorResponse({ res, error });
    } finally {
        await prisma.$disconnect();
    }
});

// *CHANGED* from /typereports/:id > to > /reports/typereports/:id
// UPDATE TYPE REPORT //
router.put("/typereports/:id", process.middlewares, async (req, res) => {
    try {
        const typereport_id = +req.params.id;
        if (!Number.isInteger(typereport_id)) {
            throw new Error("Missing typereport integer id");
        }
        let data = Object.assign({}, req.body);
        delete data.id;
        delete data.category_id;
        const updatedTypereport = await prisma.typename.update({
            where: { id: typereport_id },
            data,
        });
        return successResponse({ res, body: updatedTypereport });
    } catch (error) {
        console.error("Error: ", error);
        return errorResponse({
            res,
            message: {
                en: "Subcategory could not be created",
                es: "No se ha podido crear la subcategoria",
            },
            error,
        });
    } finally {
        await prisma.$disconnect();
    }
});

// *CHANGED* from /typereports/143/delete > to > /reports/typereports/:id/delete
// LOGICAL DELETION
// DELETE TYPE REPORT //
router.put("/typereports/:id/delete", process.middlewares, async (req, res) => {
    try {
        const typereportId = +req.params.id;
        if (!Number.isInteger(typereportId)) {
            throw new Error("Id is not valid");
        }
        const now = dates.getCurrentDate();
        const deleted = await prisma.typename.update({
            where: { id: typereportId },
            data: {
                deleted: true,
                deleted_at: now,
            },
        });
        return successResponse({
            res,
            message: {
                en: "Typereport deleted succesfully",
                es: "Se ha eliminado la subcategoria correctamente",
            },
            body: deleted,
        });
    } catch (error) {
        console.error(error);
        errorResponse({ res, error });
    } finally {
        await prisma.$disconnect();
    }
});

module.exports = router;
