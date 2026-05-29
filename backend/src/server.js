import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { motorsRouter } from "./routes/motors.js";
import { readingsRouter } from "./routes/readings.js";
import { startMqtt } from "./services/mqttClient.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.frontendOrigin,
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: env.frontendOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/readings", readingsRouter(io));
app.use("/api/motors", motorsRouter(io));

io.on("connection", (socket) => {
  console.log(`[socket] cliente conectado: ${socket.id}`);
});

await connectDatabase();
startMqtt(io);

server.listen(env.port, () => {
  console.log(`[http] backend em http://localhost:${env.port}`);
});
