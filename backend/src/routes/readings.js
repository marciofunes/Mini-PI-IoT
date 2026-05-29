import { Router } from "express";
import { latestReading, listReadings, saveReading } from "../services/readings.js";

export function readingsRouter(io) {
  const router = Router();

  router.get("/", async (req, res) => {
    try {
      const readings = await listReadings(req.query.limit);
      res.json(readings);
    } catch (error) {
      res.status(503).json({ message: error.message });
    }
  });

  router.get("/latest", async (_req, res) => {
    try {
      const reading = await latestReading();
      res.json(reading);
    } catch (error) {
      res.status(503).json({ message: error.message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const result = await saveReading(req.body, "http");
      io.emit("reading:new", result.reading);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  return router;
}
