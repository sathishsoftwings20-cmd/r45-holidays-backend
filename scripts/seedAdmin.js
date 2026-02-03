require("dotenv").config({ path: "../.env" });

const User = require("../models/user.model");
const connectDB = require("../config/db");

const seedAdmin = async () => {
  try {
    await connectDB();

    const existingAdmin = await User.findOne({
      email: "sathishsoftwings20@gmail.com",
    });

    if (existingAdmin) {
      console.log("SuperAdmin already exists");
      process.exit();
    }

    const superAdmin = new User({
      fullName: "Super Admin",
      email: "sathishsoftwings20@gmail.com",
      userName: "superadmin",
      password: "vAV3KkeN",
      role: "SuperAdmin",
    });

    await superAdmin.save();

    console.log("✅ SuperAdmin created successfully");
    console.log("User Name: superadmin");
    console.log("Email: sathishsoftwings20@gmail.com");
    console.log("Password: vAV3KkeN");

    process.exit();
  } catch (err) {
    console.error("❌ Error creating SuperAdmin:", err.message);
    process.exit(1);
  }
};

seedAdmin();
