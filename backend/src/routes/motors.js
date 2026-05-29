import { Router } from "express";
import { publishMotorCommand } from "../services/mqttClient.js";

export function motorsRouter(io) {
  const router = Router();

  router.post("/:motor/command", (req, res) => {
    try {
      const command = publishMotorCommand(req.params.motor, req.body.state);
      io.emit("motor:command", command);
      res.status(202).json(command);
    } catch (error) {
      res.status(503).json({ message: error.message });
    }
  });

  return router;
}
