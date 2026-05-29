import React from "react";
import { createRoot } from "react-dom/client";
import {
  Cpu,
  Droplets,
  Gauge,
  LogOut,
  Network,
  Power,
  Radio,
  Sun,
  Thermometer,
  Wifi,
  Zap
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { io } from "socket.io-client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const emptyReading = {
  deviceId: "aguardando-dispositivo",
  temperature: 0,
  humidity: 0,
  pressure: 0,
  luminosity: 0,
  energyConsumption: 0,
  motor1: false,
  motor2: false,
  motor3: false,
  motor4: false,
  timestamp: new Date().toISOString()
};

function Login({ onLogin }) {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");

  function submit(event) {
    event.preventDefault();
    if (username === "admin" && password === "admin") {
      setError("");
      onLogin();
      return;
    }
    setError("Usuario ou senha invalidos");
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark">
          <Network size={34} />
        </div>
        <p className="eyebrow">Industria 4.0</p>
        <h1>Monitora IoT</h1>
        <p className="login-subtitle">Sistema de telemetria em tempo real.</p>
        <form onSubmit={submit}>
          <label>
            Login
            <input
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="admin"
            />
          </label>
          {error && <span className="login-error">{error}</span>}
          <button className="primary-button" type="submit">
            Entrar
          </button>
        </form>
      </section>
      <section className="login-visual" aria-hidden="true">
        <div className="iot-orbit">
          <span className="orbit-line line-a" />
          <span className="orbit-line line-b" />
          <span className="iot-node node-hub">
            <Cpu size={34} />
          </span>
          <span className="iot-node node-wifi">
            <Wifi size={24} />
          </span>
          <span className="iot-node node-radio">
            <Radio size={24} />
          </span>
          <span className="iot-node node-sensor">
            <Thermometer size={24} />
          </span>
          <span className="iot-node node-power">
            <Zap size={24} />
          </span>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ icon, label, value, unit }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>
          {value}
          <small>{unit}</small>
        </strong>
      </div>
    </article>
  );
}

function Thermostat({ value }) {
  const clamped = Math.max(0, Math.min(60, Number(value) || 0));
  const fill = `${(clamped / 60) * 100}%`;

  return (
    <section className="thermostat">
      <div className="thermo-tube">
        <span style={{ height: fill }} />
      </div>
      <div>
        <p>Temperatura</p>
        <strong>{Number(value || 0).toFixed(1)}°C</strong>
      </div>
    </section>
  );
}

function ServoMotor({ motor, active, onToggle, pending }) {
  return (
    <article className={`servo-card ${active ? "is-on" : ""}`}>
      <div className="servo-stage">
        <div className="motor-dial">
          <span className="motor-ring" />
          <span className="motor-rotor">
            <span />
          </span>
        </div>
      </div>
      <div className="servo-copy">
        <span>Servo motor {motor}</span>
        <strong>{active ? "Ligado" : "Desligado"}</strong>
        <small>{active ? "Comando ativo" : "Aguardando comando"}</small>
      </div>
      <button
        className={active ? "danger-button" : "success-button"}
        disabled={pending}
        onClick={() => onToggle(motor, !active)}
      >
        <Power size={18} />
        {pending ? "Enviando" : active ? "Desligar" : "Ligar"}
      </button>
    </article>
  );
}

function Dashboard({ onLogout }) {
  const [reading, setReading] = React.useState(emptyReading);
  const [history, setHistory] = React.useState([]);
  const [connected, setConnected] = React.useState(false);
  const [pendingMotor, setPendingMotor] = React.useState(null);

  React.useEffect(() => {
    fetch(`${API_URL}/api/readings/latest`)
      .then((response) => response.json())
      .then((data) => {
        if (data) setReading(data);
      })
      .catch(() => undefined);

    const socket = io(API_URL);
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("reading:new", (data) => {
      setReading(data);
      setHistory((current) => {
        const next = [
          ...current,
          {
            time: new Date(data.timestamp).toLocaleTimeString("pt-BR"),
            temperature: Number(data.temperature),
            humidity: Number(data.humidity),
            energy: Number(data.energyConsumption)
          }
        ];
        return next.slice(-30);
      });
    });

    return () => socket.disconnect();
  }, []);

  async function toggleMotor(motor, state) {
    setPendingMotor(motor);
    try {
      await fetch(`${API_URL}/api/motors/${motor}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state })
      });
    } finally {
      setTimeout(() => setPendingMotor(null), 500);
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Monitora IoT - Industria 4.0</h1>
        </div>
        <div className="topbar-actions">
          <span className={connected ? "status online" : "status"}>
            {connected ? "Sistema Online" : "Sistema Offline"}
          </span>
          <button className="ghost-button" onClick={onLogout}>
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </header>

      <section className="overview-grid">
        <Thermostat value={reading.temperature} />
        <MetricCard
          icon={<Droplets size={24} />}
          label="Umidade"
          value={Number(reading.humidity || 0).toFixed(0)}
          unit="%"
        />
        <MetricCard
          icon={<Gauge size={24} />}
          label="Pressao"
          value={Number(reading.pressure || 0).toFixed(0)}
          unit="hPa"
        />
        <MetricCard
          icon={<Sun size={24} />}
          label="Luminosidade"
          value={Number(reading.luminosity || 0).toFixed(0)}
          unit="lux"
        />
        <MetricCard
          icon={<Zap size={24} />}
          label="Consumo de Energia"
          value={Number(reading.energyConsumption || 0).toFixed(2)}
          unit="kWh"
        />
      </section>

      <section className="work-area">
        <div className="panel">
          <div className="panel-heading">
            <h2>Atuadores</h2>
            <span>{reading.deviceId}</span>
          </div>
          <div className="servo-grid">
            {[1, 2, 3, 4].map((motor) => (
              <ServoMotor
                key={motor}
                motor={motor}
                active={Boolean(reading[`motor${motor}`])}
                onToggle={toggleMotor}
                pending={pendingMotor === motor}
              />
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Historico recente</h2>
            <span>{new Date(reading.timestamp).toLocaleString("pt-BR")}</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="temperature" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="energy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#dbe4ef" strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #dbe4ef", color: "#0f172a" }} />
              <Area type="monotone" dataKey="temperature" stroke="#ef4444" fill="url(#temperature)" />
              <Area type="monotone" dataKey="energy" stroke="#22c55e" fill="url(#energy)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [logged, setLogged] = React.useState(() => localStorage.getItem("iot-auth") === "true");

  if (!logged) {
    return (
      <Login
        onLogin={() => {
          localStorage.setItem("iot-auth", "true");
          setLogged(true);
        }}
      />
    );
  }

  return (
    <Dashboard
      onLogout={() => {
        localStorage.removeItem("iot-auth");
        setLogged(false);
      }}
    />
  );
}

createRoot(document.getElementById("root")).render(<App />);
