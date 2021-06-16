const express = require("express");
const prisma = require("./db");
const {
    createProfile,
    updateProfile,
    deleteProfile,
    updateCognitoProfile,
} = require("./utils/profileQueries");
const { successResponse, errorResponse } = require("../helpers/apiResponser");
const {
    ListUsersCommand,
    AdminCreateUserCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
const { SendEmailCommand } = require("@aws-sdk/client-ses");
const { getCurrentDate } = require("../helpers/dates");
const { sesClient } = require("../libs/sesClient.js");
const {
    cognitoIdentityClient,
} = require("../libs/cognitoIdentityProviderClient");

const emailTemplates = require("./utils/emailTemplates");

const router = express.Router();

const prismaWorker = {
    id: true,
    role: { select: { id: true, name: true } },
    user: {
        select: {
            id: true,
            name: true,
            last_name: true,
            email: true,
            image: true,
            phone: true,
            gender: true,
            self_gender: true,
        },
    },
    department: { select: { name: true, id: true } },
};

//createWorker
//*CHANGED* from /projects/:id/workers > to > /workers/projects/:id
//TO DO: Is user created in the organization
router.post("/projects/:id", process.middlewares, async (req, res) => {
    const { params, body, currentUser } = req;
    try {
        const profile = body;
        const projectId = +params.id;
        if (!Number.isInteger(projectId))
            return errorResponse({ res, error: "Missing CityWorker id" });
        delete profile.sms;
        // Exist user structure
        // Username: 'email@heyirys.com',
        // Attributes: [ { Name: 'sub', Value: '1xxx-x-x-x-x-xxx' } ],
        // UserCreateDate: 2020-12-19T22:46:30.739Z,
        // UserLastModifiedDate: 2020-12-19T22:47:07.137Z,
        // Enabled: true,
        // UserStatus: 'CONFIRMED'
        const user = await getOrCreateCognitoUser(profile, body.sms);
        const createData = {
            name: profile.name,
            last_name: profile.last_name,
            cognito_sub: user.Attributes[0].Value,
            email: profile.email,
        };
        // Fill optional columns
        if (profile.gender) createData.gender = profile.gender;
        if (profile.phone_number) createData.phone = profile.phone_number;
        if (profile.zipcode) createData.zipcode = profile.zipcode;
        if (profile.image) createData.image = profile.image;
        if (profile.self_gender) createData.self_gender = profile.self_gender;

        const addWorkerEvent = {
            project_id: projectId,
            organization_id: body.organization_id,
            role_id: body.role_id,
            department_id: body.department_id,
            createData: createData,
        };
        const addToProject = await createDBUser(addWorkerEvent);
        const cognito = currentUser.sub;
        const sender = await prisma.user.findUnique({
            where: { cognito_sub: cognito },
            select: {
                name: true,
                last_name: true,
                email: true,
            },
        });
        await sendEmail(
            profile.email,
            addToProject.project.name,
            sender.name,
            addToProject.project.id
        );
        return successResponse({
            res,
            body: addToProject,
        });
    } catch (error) {
        console.error("Error creating a CityWorker:", error);
        return errorResponse({
            res,
            message: {
                en: "Worker could not be created, unexpected server error",
                es: "No se ha podido crear el perfil de trabajador",
            },
            error,
        });
    } finally {
        await prisma.$disconnect();
    }
});

//Check if cognito account exists
// If not: Create cognit account with temp password
// Return  the user associated to cognito account
const getOrCreateCognitoUser = async (profile, sms) => {
    try {
        const { email, phone_number } = profile;
        let existCognitoUser = await getUserByEmailCognito(email);
        if (existCognitoUser) return existCognitoUser;
        const TP = process.env.TP;
        return await createCognitoAccount(email, sms, phone_number, TP);
    } catch (err) {
        console.log(err);
        throw err;
    }
};

const getUserByEmailCognito = async (email) => {
    try {
        let params = {
            UserPoolId: process.env.AWS_COGNITO_POOL_ID,
            AttributesToGet: ["sub"],
            Filter: `email = \"${email.toLowerCase()}\"`,
            Limit: 1,
        };
        let result = await cognitoIdentityClient.send(
            new ListUsersCommand(params)
        );
        if (result.Users.length === 0) {
            return null;
        }
        return result.Users[0]; // return to finish function
    } catch (err) {
        console.log(err, err.stack); // an error occurred
        throw err;
    }
};

const createCognitoAccount = async (email, sendSms, phone, password) => {
    try {
        let userAttrib = [
            {
                Name: "email",
                Value: `${email.toLowerCase()}`,
            },
        ];
        if (sendSms && phone) {
            userAttrib.push({
                Name: "phone_number",
                Value: phone,
            });
        }
        let params = {
            UserPoolId: process.env.AWS_COGNITO_POOL_ID,
            Username: `${email.toLowerCase()}`,
            DesiredDeliveryMediums: sendSms ? ["SMS", "EMAIL"] : ["EMAIL"],
            // ForceAliasCreation: true || false,
            // MessageAction: RESEND | SUPPRESS,
            TemporaryPassword: password,
            UserAttributes: userAttrib,
        };

        let result = await cognitoIdentityClient.send(
            new AdminCreateUserCommand(params)
        );
        console.log(result);
        if (!result.User) {
            return null;
        }
        return result.User;
    } catch (err) {
        console.log(err, err.stack); // an error occurred
        throw err;
    }
};

const createDBUser = async (event) => {
    const { createData } = event;
    try {
        const result = await prisma.worker_project.create({
            data: {
                user: {
                    connectOrCreate: {
                        where: { cognito_sub: createData.cognito_sub },
                        create: createData,
                    },
                },
                organization: { connect: { id: event.organization_id } },
                project: { connect: { id: event.project_id } },
                role: { connect: { id: event.role_id } },
                department: { connect: { id: event.department_id } },
            },
            select: {
                id: true,
                role: { select: { id: true, name: true } },
                user: {
                    select: {
                        name: true,
                        last_name: true,
                        email: true,
                        image: true,
                    },
                },
                department: { select: { name: true, id: true } },
                project: { select: { name: true, id: true } },
            },
        });
        if (result.id) {
            return result;
        } else {
            throw "Worker could not be created, server error";
        }
    } catch (e) {
        console.log(e);
        throw "Worker could not be created, server error";
    } finally {
        await prisma.$disconnect();
    }
};

const sendEmail = async (destinatary, projectName, senderWorker, projectId) => {
    var _a;

    const sender = `Irys <no-reply@heyirys.com>`;
    // Replace recipient@example.com with a "To" address. If your account
    // is still in the sandbox, this address must be verified.
    const recipient = destinatary;
    // The subject line for the email.
    const subject = `${projectName} invite you to join Irys!`;
    const prod =
        ((_a = process.env.LAMBDA_CREATE_WORKER) === null || _a === void 0
            ? void 0
            : _a.includes("prod")) || false;
    let body_html;
    if (prod && projectId === 37) {
        // The HTML body of the email.
        body_html = emailTemplates.inviteUserLaunchSA.replace(
            /example@launchsa.com/g,
            destinatary
        );
    } else {
        // The HTML body of the email.
        body_html = emailTemplates.inviteWorker
            .replace(/example@heyirys.com/g, destinatary)
            .replace(/_NAME_/g, projectName)
            .replace(/_name_/g, projectName)
            .replace(
                /_irys_web_/g,
                prod
                    ? "https://irysapp.com/login"
                    : "https://dev.irysapp.com/login"
            );
    }
    // The character encoding for the email.
    const charset = "UTF-8";
    // Create a new SES object.

    // Specify the parameters to pass to the API.
    var params = {
        Source: sender,
        Destination: {
            ToAddresses: [recipient],
        },
        Message: {
            Subject: {
                Data: subject,
                Charset: charset,
            },
            Body: {
                Html: {
                    Data: body_html,
                    Charset: charset,
                },
            },
        },
    };
    //Try to send the email.
    return await sesClient.send(new SendEmailCommand(params));
};

//updateCityWorkerProfile
router.put("/profile", process.middlewares, async (req, res) => {
    try {
        // Update Profile record
        const sub = req.currentUser.sub;
        let newEvent = {
            data: Object.assign({}, req.body),
            sub: sub,
        };
        const profile = await updateCognitoProfile(newEvent);
        successResponse({ res, body: profile });
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
    } finally {
        await prisma.$disconnect();
    }
});

//updateCityWorker
router.put("/:id", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id))
            return errorResponse({ res, error: "Missing CityWorker id" });

        const workerDetails = body.city_worker;
        // Check if Department or Role needs to be updated
        let data = {};
        if (workerDetails.deparment_id) {
            data.deparment = { connect: { id: workerDetails.deparment_id } };
        }
        if (workerDetails.role_id) {
            data.role = { connect: { id: workerDetails.role_id } };
        }

        const updatedWorker = await prisma.worker_project.update({
            where: { id },
            data,
            select: {
                id: true,
                user: {
                    select: {
                        id: true,
                    },
                },
            },
        });

        let profile = null;
        // Chek if Profile needs to be updated
        if (body.profile !== {}) {
            profile = await updateProfile({
                ...body.profile,
                id: updatedWorker.user.id,
            });
        }

        return successResponse({
            res,
            body: updatedWorker,
        });
    } catch (error) {
        console.log("Error updating a CityWorker:", error);
        return errorResponse({
            res,
            message: {
                en: "Worker could not be updated, server error",
                es: "No se ha podido actualizar el perfil de trabajador",
            },
            error,
        });
    } finally {
        await prisma.$disconnect();
    }
});

//updateCityWorker
router.put("/:id/delete", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id))
            return errorResponse({ res, error: "Missing CityWorker id" });
        // Delete worker from project
        const deleted = await prisma.worker_project.update({
            where: { id: id },
            data: { deleted: true, deleted_at: getCurrentDate() },
        });
        return successResponse({
            res,
            body: deleted,
        });
    } catch (error) {
        console.log("Error deleting a CityWorker:", error);
        return errorResponse({
            res,
            message: {
                en: "Worker could not be deleted, server error",
                es: "No se ha podido eliminar el perfil de trabajador",
            },
            error,
        });
    } finally {
        await prisma.$disconnect();
    }
});

//cognitoWorkerProfile
//TO DO: Refactor to get user information from worker projects
router.get("/profile", process.middlewares, async (req, res) => {
    try {
        const { currentUser } = req;
        const { sub } = currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
            select: {
                id: true,
                name: true,
                last_name: true,
                email: true,
                image: true,
                configurations: true,
            },
        });

        if (!user) {
            return errorResponse({
                res,
                message: {
                    en: "Cognito id does not have an associated profile",
                    es: "No existe un perfil asociado al cognito ID",
                },
                error: "Missing user",
            });
        }

        let userOrganization = await prisma.user_organization.findMany({
            where: { user_id: user.id },
            select: {
                id: true,
                organization: {
                    select: {
                        id: true,
                        name: true,
                        complete: true,
                    },
                },
            },
        });
        let organizations = userOrganization.map(
            (userOrganization) => userOrganization.organization
        );
        const projects = await prisma.worker_project.findMany({
            where: { user_id: user.id, deleted: false, enabled: true },
            select: {
                id: true,
                project: {
                    select: {
                        name: true,
                        id: true,
                        logo: true,
                        sibebar_color: true,
                        text_color: true,
                    },
                },
                organization: {
                    select: { name: true, id: true },
                },
                enabled: true,
                deleted: true,
                role: true,
            },
        });
        if (organizations.length > 0 || projects.length > 0) {
            return successResponse({
                res,
                body: Object.assign(Object.assign({}, user), {
                    organizations,
                    projects,
                }),
            });
        } else {
            return errorResponse({
                res,
                message: {
                    en: "Current user is not a worker",
                    es: "El usuario no esta registrado como trabajador",
                },
                error: "Current user is not a worker",
            });
        }
    } catch (error) {
        console.log("Error reading a CityWorker:", error);
        return errorResponse({
            res,
            message: {
                en: "Worker could not be read, server error",
                es: "No se ha podido leer el perfil de trabajador",
            },
            error,
        });
    } finally {
        await prisma.$disconnect();
    }
});

// createDashboardConfig: ${file(serverless_functions/upsert_user_project_dash.yml)}
// readDashboardConfig: ${file(serverless_functions/get_worker_branding.yml)}

// listWorkerProjects: ${file(serverless_functions/list_worker_projects.yml)}
router.get("/projects", process.middlewares, async (req, res) => {
    const { currentUser } = req;
    try {
        const { sub } = currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });
        if (!user) {
            return errorResponse({
                res,
                message: {
                    en: "Invalid user",
                    es: "Usuario no valido",
                },
                error: "User not found",
            });
        }
        const workers_projects = await prisma.worker_project.findMany({
            where: {
                user_id: user.id,
                deleted: false,
                enabled: true,
                project: { deleted: false },
            },
            select: {
                id: true,
                project: {
                    select: {
                        name: true,
                        id: true,
                        logo: true,
                        sibebar_color: true,
                        text_color: true,
                    },
                },
                organization: {
                    select: { name: true, id: true },
                },
                enabled: true,
                deleted: true,
                role: true,
            },
        });
        const projectIds = [
            ...new Set(
                workers_projects.map(
                    (workerProject) => workerProject.organization.id
                )
            ),
        ];
        const organizationPlans = await prisma.organization_plan.findMany({
            where: { organization_id: { in: projectIds } },
            select: {
                plan: {
                    select: {
                        id: true,
                        permission: true,
                    },
                },
                organization_id: true,
            },
        });

        const workerProjects = workers_projects.map((workerProject) => {
            const organizationPlan = organizationPlans.find(
                (organizationPlan) =>
                    organizationPlan.organization_id ===
                    workerProject.organization.id
            );
            const organizationPlanPermission =
                organizationPlan != null && organizationPlan.plan
                    ? organizationPlan.plan.permission
                    : {};
            const rolePermission =
                workerProject != null && workerProject.role
                    ? workerProject.role.permission
                    : {};
            let permissions = {};
            for (const [key, value] of Object.entries(
                organizationPlanPermission
            )) {
                const roleValues =
                    rolePermission[key] !== undefined
                        ? rolePermission[key]
                        : {};
                permissions[key] = Object.assign(
                    Object.assign({}, roleValues),
                    organizationPlanPermission[key]
                );
            }
            return Object.assign(Object.assign({}, workerProject), {
                permissions: permissions,
            });
        });

        return successResponse({
            res,
            body: workerProjects,
        });
    } catch (error) {
        console.log("Error listing worker projects", error);
        return errorResponse({
            res,
            message: {
                en: "Worker projects could not be listed, server error",
                es: "No se ha podido listar los proyectos del trabajador",
            },
            error,
        });
    } finally {
        await prisma.$disconnect();
    }
});

//readCityWorker
router.get("/:id", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id))
            return errorResponse({ res, error: "Missing CityWorker id" });

        const cityWorker = await prisma.worker_project.findUnique({
            where: { id },
            select: prismaWorker,
        });
        return successResponse({
            res,
            body: cityWorker,
        });
    } catch (error) {
        console.log("Error reading a CityWorker:", error);
        return errorResponse({
            res,
            message: {
                en: "Worker could not be read, server error",
                es: "No se ha podido leer el perfil de trabajador",
            },
            error,
        });
    } finally {
        await prisma.$disconnect();
    }
});

// listProjectWorkers: ${file(serverless_functions/list_project_workers.yml)}
//*CHANGED* from /projects/:id/workers > to > /workers/projects/:id
router.get("/projects/:id", process.middlewares, async (req, res) => {
    const { params: requestParams, body, currentUser } = req;
    try {
        const project_id = +requestParams.id;
        const { sub } = currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });
        if (!user) {
            return errorResponse({
                res,
                error: "Invalid user",
            });
        }
        var params = {};
        params.take = body.offset || 100;
        params.select = {
            id: true,
            role: { select: { name: true, id: true } },
            department: { select: { name: true, id: true } },
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
        params.where = {
            deleted: !true,
            project_id: project_id,
            user_id: { not: user.id },
        };
        if (body.from) {
            params.cursor = body.from;
        }
        const workers = await prisma.worker_project.findMany(params);
        return successResponse({
            res,
            body: workers,
        });
    } catch (error) {
        console.log("Error listing worker Projects:", error);
        return errorResponse({
            res,
            error,
        });
    } finally {
        await prisma.$disconnect();
    }
});

// enableWorker: ${file(serverless_functions/enable_city_worker.yml)}
router.put("/:id/enable", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id))
            return errorResponse({ res, error: "Missing CityWorker id" });
        // Update Profile record
        const disabled = await prisma.worker_project.update({
            where: { id: id },
            data: { enabled: true },
        });
        return successResponse({
            res,
            body: disabled,
        });
    } catch (error) {
        console.log("Error updating a Citizen:", error);
        return errorResponse({
            res,
            message: {
                en: "User could not be updated, server error",
                es: "No se ha podido actualizar el perfil del trabajador",
            },
            error,
        });
    } finally {
        await prisma.$disconnect();
    }
});

// disableWorker: ${file(serverless_functions/disable_city_worker.yml)}
router.put("/:id/disable", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id))
            return errorResponse({ res, error: "Missing CityWorker id" });
        // Update Profile record
        const disabled = await prisma.worker_project.update({
            where: { id: id },
            data: { enabled: false },
        });
        return successResponse({
            res,
            body: disabled,
        });
    } catch (error) {
        console.log("Error updating a Citizen:", error);
        return errorResponse({
            res,
            message: {
                en: "User could not be updated, server error",
                es: "No se ha podido actualizar el perfil del trabajador",
            },
            error,
        });
    } finally {
        await prisma.$disconnect();
    }
});

// createUserOrganization: ${file(serverless_functions/create_user-organization.yml)}
//*CHANGED* from /organizations/workers > to > /workers/organizations
router.post("/organizations", process.middlewares, async (req, res) => {
    const { body, currentUser } = req;
    try {
        // Create Profile record
        //TODO: check on this
        // let { profile, organization, plan_id } = body;
        let profile = {},
            organization = {},
            plan_id;
        const user = await createProfile({
            ...req.body,
            cognito_sub: currentUser.sub,
        });
        if (!organization?.name) {
            organization.name = `${user.name}'s organization`;
        }
        const planOrganization = await prisma.organization_plan.create({
            data: {
                organization: {
                    create: {
                        name: organization.name,
                        contact: profile.email,
                    },
                },
                plan: { connect: { id: plan_id || 1 } },
            },
            select: {
                id: true,
                organization: true,
            },
        });
        const userOrganization = await prisma.user_organization.create({
            data: {
                user: { connect: { id: user.id } },
                organization: {
                    connect: { id: planOrganization.organization.id },
                },
            },
            include: {
                user: true,
            },
        });
        // Returns the object response
        return successResponse({
            res,
            body: {
                userOrganization,
                organization: planOrganization.organization,
            },
        });
    } catch (error) {
        console.error("Error creating Worker and organization:", error);
        return errorResponse({
            res,
            message: {
                en: "Worker and organization could not be created, server error",
                es: "No se ha podido crear el perfil de trabajador",
            },
            error,
        });
    } finally {
        await prisma.$disconnect();
    }
});

// searchByEmail : ${file(serverless_functions/search_workers_by_email.yml)}
//*CHANGED* from /projects/id/workers/search > to > /workers/search/project/id
router.get("/search/projects/:id", process.middlewares, async (req, res) => {
    const { query, params } = req;
    try {
        const email = query.email;
        const workerProjects = await prisma.worker_project.findMany({
            where: {
                user: { email: { contains: email, mode: "insensitive" } },
                project_id: +params.id,
                deleted: !true,
            },
            take: 100,
            select: {
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
        const userProjects = await prisma.user_project.findMany({
            where: {
                user: { email: { contains: email, mode: "insensitive" } },
                project_id: +params.id,
                deleted: !true,
            },
            take: 100,
            select: {
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
        const workerUser = workerProjects.map((worker) => worker.user);
        const appUsers = userProjects.map((appUser) => appUser.user);
        var ids = new Set(workerUser.map((workerUser) => workerUser.id));
        var mergedUsers = [
            ...workerUser,
            ...appUsers.filter((appUser) => !ids.has(appUser.id)),
        ];
        return successResponse({
            res,
            body: mergedUsers,
        });
    } catch (error) {
        console.log("Error listing workers", error);
        return errorResponse({
            res,
            message: {
                en: "Workers could not be search, server error",
                es: "No se ha podido buscar los trabajadores",
            },
            error,
        });
    } finally {
        await prisma.$disconnect();
    }
});

module.exports = router;
