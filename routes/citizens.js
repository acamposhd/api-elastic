const express = require("express");
const prisma = require("./db");
const {
    createProfile,
    updateProfile,
    deleteProfile,
    updateCognitoProfile,
} = require("./utils/profileQueries");
const { successResponse, errorResponse } = require("../helpers/apiResponser");

const router = express.Router();

const prismaUser = {
    user: {
        select: {
            email: true,
            last_name: true,
            name: true,
        },
    },
    project: {
        select: {
            id: true,
            name: true,
        },
    },
};

//createCitizen
router.post("/", process.middlewares, async (req, res) => {
    try {
        // Create Profile record
        const profile = await createProfile(req.body);
        // Returns the object response
        return successResponse({ res, body: profile });
    } catch (error) {
        console.error("Error creating a Citizen:", error);
        return errorResponse({
            res,
            message: {
                en: "Citizen could not be created, server error",
                es: "No se ha podido crear el perfil de ciudadano",
            },
            error,
        });
    } 
});

//updateCitizen
router.put("/:id", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id))
            return errorResponse({ res, error: "Missing Citizen id" });

        const profile = await updateProfile({ ...body, id: params.id });
        return successResponse({
            res,
            body: profile,
        });
    } catch (error) {
        console.log("Error updating a Citizen:", error);
        return errorResponse({
            res,
            message: {
                en: "Citizen could not be updated, server error",
                es: "No se ha podido actualizar el perfil de usuario",
            },
            error,
        });
    } 
});

//deleteCitizen
router.put("/:id/delete", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id))
            return errorResponse({ res, error: "Missing Citizen id" });

        const deleted = await deleteProfile(id);
        return successResponse({
            res,
            body: deleted,
        });
    } catch (error) {
        console.log("Error deleting a Citizen:", error);
        return errorResponse({
            res,
            message: {
                en: "Citizen could not be deleted, server error",
                es: "No se ha podido eliminar el perfil de usuario",
            },
            error,
        });
    } 
});

//listProjectCitizen
//*CHANGED* from /projects/:id/citizen > to > /citizens/projects/:id
router.get("/projects/:id", process.middlewares, async (req, res) => {
    const { body, params } = req;
    try {
        const project_id = +params.id;
        let prismaParams = {};
        prismaParams.take = body.offset || 100;
        prismaParams.select = {
            id: true,
            user: {
                select: {
                    name: true,
                    last_name: true,
                    email: true,
                    id: true,
                    image: true,
                    phone: true,
                    gender: true,
                    self_gender: true,
                },
            },
            enabled: true,
            deleted: true,
            deleted_at: true,
        };
        prismaParams.where = { project_id: project_id };
        if (body.from) {
            prismaParams.cursor = body.from;
        }
        const projectCitizens = await prisma.user_project.findMany(
            prismaParams
        );
        return successResponse({
            res,
            body: projectCitizens,
        });
    } catch (error) {
        console.log("Error listing Citizens:", error);
        return errorResponse({
            res,
            message: {
                en: "Citizen could not be listed, server error",
                es: "No se ha podido listar los usuarios",
            },
            error,
        });
    } 
});

//citizenProfile
router.get("/profile", process.middlewares, async (req, res) => {
    const { currentUser } = req;
    try {
        const { sub } = currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });
        return successResponse({
            res,
            body: user,
        });
    } catch (error) {
        console.log("Error reading a CityWorker:", error);
        return errorResponse({
            res,
            message: {
                en: "User profile could not be read, server error",
                es: "No se ha podido leer el perfil del usuario",
            },
            error,
        });
    } 
});

//listCitizenProjects
router.get("/projects", process.middlewares, async (req, res) => {
    const { body, currentUser } = req;
    try {
        const { sub } = currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });
        if (user) {
            const citizen_projects = await prisma.user_project.findMany({
                where: { user_id: user.id },
                select: {
                    id: true,
                    project: {
                        select: { name: true, id: true, logo: true },
                    },
                    organization: {
                        select: { name: true, id: true },
                    },
                },
            });
            return successResponse({
                res,
                body: citizen_projects,
            });
        } else {
            errorRespons({
                res,
                message: {
                    en: "Innvalid user",
                    es: "Usuario no valido",
                },
                error,
            });
        }
    } catch (error) {
        console.log("Error listing Citizens:", error);
        return errorResponse({
            res,
            message: {
                en: "Citizen projects could not be listed, server error",
                es: "No se ha podido listar los proyectos del usuario",
            },
            error,
        });
    } 
});

//readCitizen
//To do: Check if required move get citizen using user_project id
router.get("/:id", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id))
            return errorResponse({ res, error: "Missing Citizen profile_id" });

        const citizen = await prisma.user.findUnique({
            where: { id },
        });
        return successResponse({
            res,
            body: citizen,
        });
    } catch (error) {
        console.log("Error reading a Citizen:", error);
        return errorResponse({
            res,
            message: {
                en: "Citizen could not be read, server error",
                es: "No se ha podido leer el perfil de ciudadano",
            },
            error,
        });
    } 
});

//updateCitizenProfile
// TO DO: Allow if is current user
router.put("/profile", process.middlewares, async (req, res) => {
    console.log("entra ");
    const { body, currentUser } = req;
    try {
        // Update Profile record
        let newEvent = { data: Object.assign({}, body), sub: currentUser.sub };
        const updated = await updateCognitoProfile(newEvent);
        return successResponse({
            res,
            body: updated,
        });
    } catch (error) {
        console.log("Error updating a Citizen:", error);
        return errorResponse({
            res,
            message: {
                en: "User could not be updated, server error",
                es: "No se ha podido actualizar el perfil de usuario",
            },
            error,
        });
    } 
});

//createCitizenWithProject
//*CHANGED* from /projects/:id/citizen > to > /citizens/projects/:id/launchsa
router.post("/projects/:id/launchsa", process.middlewares, async (req, res) => {
    const { body, currentUser } = req;
    try {
        const { sub } = currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });
        let createdUser;
        const createUser = {
            email: body.email,
            name: body.name,
            cognito_sub: body.cognito_sub,
            last_name: body.last_name,
        };

        if (!user) {
            createdUser = await prisma.user_project.create({
                data: {
                    enabled: true,
                    user: {
                        create: createUser,
                    },
                    project: { connect: { id: body.project_id } },
                    organization: { connect: { id: body.organization_id } },
                },
                select: prismaUser,
            });
        } else {
            createdUser = await prisma.user_project.upsert({
                create: {
                    user: {
                        connectOrCreate: {
                            where: { cognito_sub: sub },
                            create: createUser,
                        },
                    },
                    enabled: true,
                    project: { connect: { id: body.project_id } },
                    organization: { connect: { id: body.organization_id } },
                },
                update: {
                    user: {
                        update: {
                            email: body.email,
                            name: body.name,
                            last_name: body.last_name,
                        },
                    },
                },
                where: {
                    user_organization_project: {
                        user_id: user.id,
                        project_id: event.project_id,
                        organization_id: body.organization_id,
                    },
                },
                select: prismaUser,
            });
        }
        // Returns the object response
        return successResponse({
            res,
            body: createdUser,
        });
    } catch (error) {
        console.error("Error creating a Citizen:", error);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            message: {
                en: "Citizen could not be created, server error",
                es: "No se ha podido crear el perfil de ciudadano",
            },
            body: event,
        };
    } 
});

//disableCitizen
router.put("/:id/disable", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id))
            return errorResponse({ res, error: "Missing Citizen id" });

        // Update Profile record
        const updated = await prisma.user_project.update({
            where: { id: id },
            data: { enabled: false },
        });
        return successResponse({
            res,
            body: updated,
        });
    } catch (error) {
        console.log("Error disabling a Citizen:", error);
        return errorResponse({
            res,
            message: {
                en: "Citizen could not be disabled, server error",
                es: "No se ha podido deshabilitar el perfil de usuario",
            },
            error,
        });
    } 
});

//enableCitizens
router.put("/:id/enable", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id))
            return errorResponse({ res, error: "Missing Citizen id" });
        // Update Profile record
        const updated = await prisma.user_project.update({
            where: { id },
            data: { enabled: true },
        });

        return successResponse({
            res,
            body: updated,
        });
    } catch (error) {
        console.log("Error enabling a Citizen:", error);
        return errorResponse({
            res,
            message: {
                en: "Citizen could not be enabled, server error",
                es: "No se ha podido habilitar el perfil de usuario",
            },
            error,
        });
    } 
});

module.exports = router;
