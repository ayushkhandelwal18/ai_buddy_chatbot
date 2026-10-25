import { connect } from "mongoose";

async function connectToDatabase() {
  try {
    await connect(process.env.MONGO_URL);
  } catch (error) {
    console.log(error);
    throw new Error("Cannot connect to MongoDb");
  }
}


export { connectToDatabase };
