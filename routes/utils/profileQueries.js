const prisma = require('../db');
const {getCurrentDate} = require("../../helpers/dates")

const createProfile = async(body) => {
    try {
        // Fill required columns
        const data = {
            name: body.name,
            last_name: body.last_name,
            cognito_sub: body.cognito_sub
        };
        // Fill optional columns
        if (body.gender)
            data.gender = body.gender;
        if (body.email)
            data.email = body.email;
        if (body.phone_number)
            data.phone = body.phone_number;
        if (body.zipcode)
            data.zipcode = body.zipcode;
        if (body.image)
            data.image = body.image;
        if (body.self_gender)
            data.self_gender = body.self_gender;
        // Store new user in database
        const profile = await prisma.user.create({ data });
        // Returns the object response
        return profile;
    }
    catch (error) {
        console.error("Error creating a Profile:", error);
        throw new Error(error);
    }
}
  
const updateProfile = async (event) => {
    try {
        
        const id = +event.id;
        if (!Number.isInteger(id))
            throw new Error("Missing Profile id");
        const data = {};
        if (event.email)
            data.email = event.email;
        if (event.gender)
            data.gender = event.gender;
        if (event.name)
            data.name = event.name;
        if (event.last_name)
            data.last_name = event.last_name;
        if (event.phone)
            data.phone = event.phone;
        if (event.disabled)
            data.disabled = event.disabled;
        if (event.zipcode)
            data.zipcode = event.zipcode;
        if (event.image)
            data.image = event.image;
        if (event.ethnicity)
            data.ethnicity = event.ethnicity;
        if (event.birthday)
            data.birthday = event.birthday;
        if (event.self_gender)
            data.self_gender = event.self_gender;

        data.updated_at = getCurrentDate();
        const profile = await prisma.user.update({
            where: { id },
            data,
        });
        return profile;
    }
    catch (error) {
        console.log("Error updating a Profile:", error);
        throw new Error(error);
    }
};
  
const deleteProfile = async (id) => {
    try {
        const now = getCurrentDate();
        let data = {
            deleted: true,
            deleted_at: now
        };
        const deleted = await prisma.user.update({
            where: { id },
            data
        });
        
        return deleted
    }
    catch (error) {
        console.log("Error deleting a Profile:", error);
        throw error;
    }
    };

const updateCognitoProfile = async (event) => {
    try {
        const cognito = event.sub;
        // Update Profile record
        const data = Object.assign({}, event.data);
        data.updated_at = getCurrentDate();
        const profile = await prisma.user.update({
            where: { cognito_sub: cognito },
            data,
        });
        return profile
    }
    catch (error) {
        console.log("Error updating a Citizen:", error);
        throw error;
    }
};

module.exports = {createProfile, updateProfile, deleteProfile, updateCognitoProfile}