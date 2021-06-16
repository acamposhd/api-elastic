const express = require("express");
const prisma = require("./db");
const router = express.Router();
const { getCurrentDate } = require("../helpers/dates");
const { successResponse, errorResponse } = require("../helpers/apiResponser");
const permissions = require("../helpers/permissions");
const emailTemplates = require("./utils/emailTemplates");
const { sesClient } = require("../libs/sesClient.js");
const { SendEmailCommand } = require("@aws-sdk/client-ses");

const sesParams = (sender, recipient, subject, body_html) => {
    // The character encoding for the email.
    const charset = "UTF-8";

    // Specify the parameters to pass to the API.
    return {
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
};

const selectFromProject = {
    name: true,
    description: true,
    address: true,
    latitude: true,
    longitude: true,
    completion_status: true,
    instagram_url: true,
    twitter_url: true,
    facebook_url: true,
    linkedin_url: true,
    organization: {
        select: {
            name: true,
            contact: true,
            avatar: true,
        },
    },
};

// listProjectDepartments
// Modified route
router.get("/:id/departments", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const projectId = +params.id;
        if (!Number.isInteger(projectId)) {
            return errorResponse({ res, error: "ID is not valid" });
        }
        let queryParams = {
            where: { project_id: projectId },
            take: body.offset || 100,
        };
        if (body.from) {
            queryParams.cursor = body.from;
        }
        const departments = await prisma.department.findMany(queryParams);
        return successResponse({
            res,
            message: {
                en: "Project deparments listed succesfully",
                es: "Se han listado los departamentos de proyecto correctamente",
            },
            body: departments,
        });
    } catch (error) {
        console.log("Error listing Departments:", error);
        return errorResponse({ res, error });
    } finally {
        await prisma.$disconnect();
    }
});

//createProject
router.post("/", process.middlewares, async (req, res) => {
    try {
        const { body } = req;
        const { sub } = req.currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });

        if (!user) {
            return errorResponse({
                res,
                code: 403,
                message: {
                    es: "Usuario no valido",
                    en: "Invalid user",
                },
                error: "Usuario no valido",
            });
        }
        const data = Object.assign({}, body);
        delete data.organization_id;
        delete data.director_id;
        delete data.sub;
        data.organization = { connect: { id: body.organization_id } };
        data.user_project_director_idTouser = { connect: { id: user.id } };

        //To do: Check if organization name exist
        const project = await prisma.project.create({
            data,
        });
        const department = await prisma.department.create({
            data: {
                project_department_project_idToproject: {
                    connect: { id: project.id },
                },
                project_department_organization_idToproject: {
                    connect: { id: project.organization_id },
                },
                name: "General",
                color: "",
            },
        });
        await prisma.event_topic.create({
            data: {
                project: { connect: { id: project.id } },
                organization: { connect: { id: project.organization_id } },
                name: "General",
            },
        });
        await prisma.resource_category.create({
            data: {
                project_projectToresource_category_project_id: {
                    connect: { id: project.id },
                },
                project_projectToresource_category_organization_id: {
                    connect: { id: project.organization_id },
                },
                name: "General",
            },
        });
        const ownerRole = await prisma.role.create({
            data: {
                project: { connect: { id: project.id } },
                organization: { connect: { id: project.organization_id } },
                name: "Owner",
                permission: permissions.owner,
            },
        });
        await prisma.role.createMany({
            data: [
                {
                    project_id: project.id,
                    organization_id: project.organization_id,
                    name: "Admin",
                    permission: permissions.admin,
                },
                {
                    project_id: project.id,
                    organization_id: project.organization_id,
                    name: "Manager",
                    permission: permissions.manager,
                },
                {
                    project_id: project.id,
                    organization_id: project.organization_id,
                    name: "Viewer",
                    permission: permissions.viewer,
                },
            ],
            skipDuplicates: true,
        });
        await prisma.worker_project.create({
            data: {
                organization_id: project.organization_id,
                project_id: project.id,
                user_id: user.id,
                department_id: department.id,
                role_id: ownerRole.id,
            },
        });
        // Returns the object response
        return successResponse({
            res,
            message: {
                en: "Project creted sucessfully",
                es: "Se creó el proyecto",
            },
            body: project,
        });
    } catch (error) {
        console.error("Error creating a Project:", error);
        return errorResponse({ res, error });
    } finally {
        await prisma.$disconnect();
    }
});

//readProject
router.get("/:id", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id))
            return errorResponse({ res, error: "Missing project id" });

        const project = await prisma.project.findUnique({
            where: { id },
            select: selectFromProject,
        });
        return successResponse({
            res,
            message: {
                en: "Project listed succesfully",
                es: "Información del proyecto listada correctamente",
            },
            body: project,
        });
    } catch (error) {
        console.log("Error reading a Project:", error);
        return errorResponse({ res, error });
    } finally {
        await prisma.$disconnect();
    }
});

//updateProject
router.put("/:id", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id))
            return errorResponse({ res, error: "Missing project id" });
        const data = body.data;

        if (data.director_id) {
            data.user_project_director_idTouser = { connect: data.director_id };
        }
        delete data.director_id;

        const updatedProject = await prisma.project.update({
            where: { id },
            data,
        });

        return successResponse({
            res,
            message: {
                en: "Project updated succesfully",
                es: "Proyecto actualizado correctamente",
            },
            body: updatedProject,
        });
    } catch (error) {
        console.log("Error updating a Project:", error);
        return errorResponse({ res, error });
    } finally {
        await prisma.$disconnect();
    }
});

//projectResume
router.get("/:id/resume", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const project_id = +params.id;
        if (!Number.isInteger(project_id))
            return errorResponse({ res, error: "Missing project id" });

        const countUsers = await prisma.user_project.count({
            where: { project_id: project_id, deleted: false },
        });
        const countWorkers = await prisma.worker_project.count({
            where: { project_id: project_id, deleted: false },
        });
        let createdReports = await prisma.report.groupBy({
            by: ["status"],
            where: {
                project_id: project_id,
            },
            count: {
                status: true,
            },
        });
        let resumeReports = {
            rejected: 0,
            blocked: 0,
            closed: 0,
            open: 0,
            resolved: 0,
            pending: 0,
        };
        createdReports.forEach(
            (report) => (resumeReports[report.status] = report.count.status)
        );
        return successResponse({
            res,
            body: {
                users: countUsers,
                workers: countWorkers,
                flags: resumeReports,
            },
        });
    } catch (error) {
        console.log("Error reading a project data:", error);
        return errorResponse({
            res,
            error,
            message: {
                en: "Project could not be read, server error",
                es: "No se han podido recopilar la información del proyecto",
            },
        });
    } finally {
        await prisma.$disconnect();
    }
});

//deleteProject
router.put("/:id/delete", process.middlewares, async (req, res) => {
    const { params } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id))
            return errorResponse({ res, error: "Missing project id" });

        const deleted = await prisma.project.update({
            where: { id },
            data: { deleted: true, deleted_at: getCurrentDate() },
        });
        return successResponse({ res, body: deleted });
    } catch (error) {
        console.log("Error deleting a Project:", error);
        return errorResponse({ res, error });
    } finally {
        await prisma.$disconnect();
    }
});

//listProjects
router.get("/", process.middlewares, async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            where: { deleted: !true, published: true },
            select: selectFromProject,
        });
        return successResponse({ res, body: projects });
    } catch (error) {
        console.log("Error listing Projects:", error);
        return errorResponse({ res, error });
    } finally {
        await prisma.$disconnect();
    }
});

//joinProject
router.post("/:id/join", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const project_id = +params.id;
        if (!Number.isInteger(project_id))
            return errorResponse({ res, error: "Missing project id" });

        const project = await prisma.project.findUnique({
            where: { id: project_id },
        });
        const { sub } = req.currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });

        const userProject = await prisma.user_project.findUnique({
            where: {
                user_organization_project: {
                    organization_id: project.organization_id,
                    user_id: user.id,
                    project_id: project_id,
                },
            },
        });
        //Return if already exists
        if (userProject) {
            return successResponse({ res, body: userProject });
        }

        if (project && project.organization_id && user && user.id) {
            if (!project.is_private) {
                const joinPublic = await prisma.user_project.create({
                    data: {
                        project: { connect: { id: project.id } },
                        organization: {
                            connect: { id: project.organization_id },
                        },
                        user: { connect: { id: user.id } },
                    },
                });
                return successResponse({ res, body: joinPublic });
            } else if (project.is_private && body.code) {
                const join = await joinPrivateProject(user, project, body.code);
                return join;
            } else {
                return errorResponse({
                    res,
                    code: 404,
                    error: "Project is private",
                });
            }
        } else {
            return errorResponse({
                res,
                code: 404,
                error: "Invalid project ID or user ID",
            });
        }
    } catch (error) {
        console.log("Error Joining to project:", error);
        return errorResponse({
            res,
            message: {
                en: "Error joining to project",
                es: "Error uniendose al proyecto",
            },
            error,
        });
    } finally {
        await prisma.$disconnect();
    }
});

const joinPrivateProject = async (user, project, code, res) => {
    const invitation = await prisma.project_inscription.findUnique({
        where: {
            project_inscription_email_project_id_idx: {
                email: user.email,
                project_id: project.id,
            },
        },
    });
    if (invitation) {
        if (invitation.code === code) {
            await prisma.project_inscription.update({
                where: {
                    project_inscription_email_project_id_idx: {
                        email: user.email,
                        project_id: project.id,
                    },
                },
                data: {
                    status: "accepted",
                },
            });
            const joinProject = await prisma.user_project.create({
                data: {
                    project: { connect: { id: project.id } },
                    organization: { connect: { id: project.organization_id } },
                    user: { connect: { id: user.id } },
                },
            });
            return successResponse({ res, body: joinProject });
        } else {
            return errorResponse({
                res,
                message: {
                    en: "Invalid code",
                    es: "Código invalido",
                },
                body: code,
            });
        }
    } else {
        return errorResponse({
            res,
            message: {
                en: "No valid invitation found for project",
                es: "No existe un invitación para el proyecto",
            },
            error: "No valid invitation found for project",
        });
    }
};

//getCitizenProject
router.get("/:id/join", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const project_id = +params.id;
        if (!Number.isInteger(project_id))
            return errorResponse({ res, error: "Missing project id" });

        const { sub } = req.currentUser;
        const user = await prisma.user.findUnique({
            where: { cognito_sub: sub },
        });
        const project = await prisma.project.findUnique({
            where: { id: project_id },
        });
        if (
            user &&
            (project === null || project === void 0
                ? void 0
                : project.organization_id)
        ) {
            const userProject = await prisma.user_project.findUnique({
                where: {
                    user_organization_project: {
                        organization_id: project.organization_id,
                        user_id: user.id,
                        project_id: project_id,
                    },
                },
            });
            return successResponse({ res, body: userProject });
        } else {
            return errorResponse({ res, error: "Invalid user/project" });
        }
    } catch (error) {
        console.log("Error checking if user is in the project", error);
        return errorResponse({ res, error });
    } finally {
        await prisma.$disconnect();
    }
});

//inviteCitizenToProject
router.post("/:id/invite", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const project_id = +params.id;
        const email = body.email;
        if (!Number.isInteger(project_id))
            return errorResponse({ res, error: "Missing project id" });

        const project = await prisma.project.findUnique({
            where: { id: project_id },
            select: {
                id: true,
                organization: {
                    select: { id: true, name: true },
                },
                name: true,
                is_private: true,
            },
        });
        if (project && project.organization && project.organization.id) {
            // Replace sender@example.com with your "From" address.
            // This address must be verified with Amazon SES.
            const sender = `${project.name} <no-reply@heyirys.com>`;
            // Replace recipient@example.com with a "To" address. If your account
            // is still in the sandbox, this address must be verified.
            const recipient = email;
            const subject = `You have an invitation to join ${project.name}`;
            let code = "";
            let body_html;
            if (process.env.NODE_ENV === "production" && project_id === 37) {
                const { sub } = req.currentUser;
                const user = await prisma.user.findUnique({
                    where: { cognito_sub: sub },
                });
                body_html = emailsTemplate.inviteUserLaunchSA
                    .replace(/example@launchsa.com/g, email)
                    .replace("[Name]", user ? user.name : "LaunchSA");
            } else {
                const uri = `https://app.heyirys.com/?link=https://www.heyirys.com/?id%3D${project.id}&apn=com.heyirys.irysapp&isi=1550376603&ibi=com.heyirys.irysapp`;
                // The HTML body of the email.
                body_html = emailTemplates.userInvite
                    .replace(/example@heyirys.com/g, email)
                    .replace("[Organization Name]", project.organization.name)
                    .replace("[Project Name]", project.name)
                    .replace("irys://home", `${uri}`);
            }
            if (project.is_private) {
                code = (Math.floor(Math.random() * 10000) + 10000)
                    .toString()
                    .substring(1);
                body_html = body_html.replace("####", code);
            } else {
                body_html = body_html
                    .replace(/####/g, "")
                    .replace(/Your code:/g, "");
            }

            const invitationEvent = {
                email: email,
                project: { connect: { id: project.id } },
                organization: { connect: { id: project.organization.id } },
                code: code,
            };

            const result = await createDBInvitation(invitationEvent);
            await sesClient.send(
                new SendEmailCommand(
                    sesParams(sender, recipient, subject, body_html)
                )
            );

            return successResponse({ res, body: result });
        } else {
            return errorResponse({
                res,
                code: 404,
                error: "Invalid project ID or user ID",
            });
        }
    } catch (error) {
        console.log("Error inviting to project:", error);
        return errorResponse({
            res,
            error,
            message: {
                en: "Error inviting to project",
                es: "Error invitando al proyecto",
            },
        });
    }
});

const createDBInvitation = async (data) => {
    try {
        const invitation = await prisma.project_inscription.upsert({
            where: {
                project_inscription_email_project_id_idx: {
                    project_id: data.project.connect.id,
                    email: data.email,
                },
            },
            update: {
                code: data.code,
            },
            create: data,
        });

        return invitation;
    } catch (e) {
        console.log(e);
        throw e;
    } finally {
        await prisma.$disconnect();
    }
};

module.exports = router;
