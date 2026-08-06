import { connect, disconnect } from "mongoose";

async function connectToDatabase() {
  try {
    await connect(process.env.MONGO_URL);
  } catch (error) {
    console.log(error);
    throw new Error("Cannot connect to MongoDb");
  }
}


async function disconnectFromDatabase() {
    try{
        await disconnect();

    }catch (error) {
    console.log(error);
    throw new Error("Cannot disconnect to MongoDb");
  }
}

export{ connectToDatabase, disconnectFromDatabase };
