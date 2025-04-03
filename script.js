// Configuration
let config = {
  windowSize: 4,
  totalPackets: 20,
  packetLossRate: 20, // percentage
  ackLossRate: 10, // percentage
  timeout: 3000, // ms
  speed: 1,
};

// Stats tracking
let stats = {
  packetsSent: 0,
  packetsReceived: 0,
  packetsLost: 0,
  acksSent: 0,
  acksLost: 0,
  timeouts: 0,
};

// State variables
let state = {
  base: 0,
  nextSeqNum: 0,
  expectedSeqNum: 0,
  senderBuffer: [],
  receiverBuffer: [],
  inFlight: [],
  timeoutEvents: {},
  simRunning: false,
  isPaused: false,
};

// DOM Elements
const simulation = document.getElementById("simulation");
const senderBuffer = document.getElementById("sender-buffer");
const receiverBuffer = document.getElementById("receiver-buffer");
const logContainer = document.getElementById("log");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const resetBtn = document.getElementById("reset-btn");
const speedSlider = document.getElementById("speed");
const speedValue = document.getElementById("speed-value");
const windowSizeInput = document.getElementById("window-size");
const packetLossInput = document.getElementById("packet-loss");
const ackLossInput = document.getElementById("ack-loss");
const timeoutInput = document.getElementById("timeout");

// Stats elements
const packetsSentEl = document.getElementById("packets-sent");
const packetsReceivedEl = document.getElementById("packets-received");
const packetsLostEl = document.getElementById("packets-lost");
const acksSentEl = document.getElementById("acks-sent");
const acksLostEl = document.getElementById("acks-lost");
const timeoutsEl = document.getElementById("timeouts");

// Initialize the simulation
function initialize() {
  // Clear previous state
  state = {
    base: 0,
    nextSeqNum: 0,
    expectedSeqNum: 0,
    senderBuffer: [],
    receiverBuffer: [],
    inFlight: [],
    timeoutEvents: {},
    simRunning: false,
    isPaused: false,
  };

  // Reset stats
  stats = {
    packetsSent: 0,
    packetsReceived: 0,
    packetsLost: 0,
    acksSent: 0,
    acksLost: 0,
    timeouts: 0,
  };
  updateStatsDisplay();

  // Read configuration from inputs
  config.windowSize = parseInt(windowSizeInput.value);
  config.packetLossRate = parseInt(packetLossInput.value);
  config.ackLossRate = parseInt(ackLossInput.value);
  config.timeout = parseInt(timeoutInput.value);

  // Clear DOM elements
  senderBuffer.innerHTML = "";
  receiverBuffer.innerHTML = "";
  simulation.querySelectorAll(".packet").forEach((el) => el.remove());
  logContainer.innerHTML = "";

  // Initialize buffers
  for (let i = 0; i < config.totalPackets; i++) {
    const senderItem = document.createElement("div");
    senderItem.className = "buffer-item";
    senderItem.textContent = i;
    senderItem.id = `sender-${i}`;
    senderBuffer.appendChild(senderItem);
    state.senderBuffer.push({
      seqNum: i,
      status: "unsent",
      element: senderItem,
    });

    const receiverItem = document.createElement("div");
    receiverItem.className = "buffer-item";
    receiverItem.textContent = i;
    receiverItem.id = `receiver-${i}`;
    receiverBuffer.appendChild(receiverItem);
    state.receiverBuffer.push({
      seqNum: i,
      status: "awaiting",
      element: receiverItem,
    });
  }

  logEvent(
    "System",
    "Simulation initialized with window size: " + config.windowSize
  );
  updateWindow();
}

// Update stats display
function updateStatsDisplay() {
  packetsSentEl.textContent = stats.packetsSent;
  packetsReceivedEl.textContent = stats.packetsReceived;
  packetsLostEl.textContent = stats.packetsLost;
  acksSentEl.textContent = stats.acksSent;
  acksLostEl.textContent = stats.acksLost;
  timeoutsEl.textContent = stats.timeouts;
}

// Update the visual representation of the window
function updateWindow() {
  // Update sender window
  document
    .querySelectorAll(".window")
    .forEach((el) => el.classList.remove("window"));

  const windowEnd = Math.min(
    state.base + config.windowSize,
    config.totalPackets
  );
  for (let i = state.base; i < windowEnd; i++) {
    if (i < state.senderBuffer.length) {
      state.senderBuffer[i].element.classList.add("window");
    }
  }

  // Update receiver window
  const receiverWindowEnd = Math.min(
    state.expectedSeqNum + config.windowSize,
    config.totalPackets
  );
  for (let i = state.expectedSeqNum; i < receiverWindowEnd; i++) {
    if (i < state.receiverBuffer.length) {
      state.receiverBuffer[i].element.classList.add("window");
    }
  }
}

// Log events to the event log
function logEvent(type, message) {
  const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
  const logEntry = document.createElement("div");
  logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span> <span class="log-${type.toLowerCase()}">${type}:</span> ${message}`;
  logContainer.appendChild(logEntry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

// Create a visual packet element
function createPacketElement(seqNum, isAck, isLost = false) {
  const packet = document.createElement("div");
  packet.className = `packet ${isAck ? "ack" : "regular-packet"} ${
    isLost ? "lost" : ""
  }`;
  packet.textContent = isAck ? `ACK ${seqNum}` : `Packet ${seqNum}`;
  packet.id = isAck ? `ack-${seqNum}` : `packet-${seqNum}`;
  simulation.appendChild(packet);
  return packet;
}

// Animate packet transmission from sender to receiver
function animatePacketTransmission(seqNum, isLost = false) {
  const sender = document.querySelector(".sender");
  const receiver = document.querySelector(".receiver");

  const packetEl = createPacketElement(seqNum, false, isLost);

  // Get positions for animation
  const senderRect = sender.getBoundingClientRect();
  const receiverRect = receiver.getBoundingClientRect();
  const simulationRect = simulation.getBoundingClientRect();

  // Set starting position (from sender's right edge)
  const startX = senderRect.right - simulationRect.left;
  const startY = senderRect.top + senderRect.height / 2 - simulationRect.top;

  // Set ending position (at receiver's left edge)
  const endX = receiverRect.left - simulationRect.left - packetEl.offsetWidth;
  const endY = receiverRect.top + receiverRect.height / 2 - simulationRect.top;

  // Calculate middle point for packet loss visualization
  const midX = startX + (endX - startX) / 2;
  const midY = startY + (endY - startY) / 2;

  // Set initial position
  packetEl.style.left = `${startX}px`;
  packetEl.style.top = `${startY}px`;

  // Adjust animation speed based on user setting
  const duration = 1500 / config.speed;
  const lostDuration = 800 / config.speed;

  if (isLost) {
    // Animate the packet to the middle then disappear
    setTimeout(() => {
      packetEl.style.transition = `left ${lostDuration}ms ease-in-out, top ${lostDuration}ms ease-in-out`;
      packetEl.style.left = `${midX}px`;
      packetEl.style.top = `${midY}px`;

      setTimeout(() => {
        packetEl.classList.add("lost");

        setTimeout(() => {
          packetEl.remove();
        }, 1000);
      }, lostDuration);
    }, 50);
  } else {
    // Animate the packet from sender to receiver
    setTimeout(() => {
      packetEl.style.transition = `left ${duration}ms ease-in-out, top ${duration}ms ease-in-out`;
      packetEl.style.left = `${endX}px`;
      packetEl.style.top = `${endY}px`;

      setTimeout(() => {
        packetEl.remove();
      }, duration + 100);
    }, 50);
  }
}

// Animate ACK transmission from receiver to sender
function animateAckTransmission(seqNum, isLost = false) {
  const sender = document.querySelector(".sender");
  const receiver = document.querySelector(".receiver");

  const ackEl = createPacketElement(seqNum, true, isLost);

  // Get positions for animation
  const senderRect = sender.getBoundingClientRect();
  const receiverRect = receiver.getBoundingClientRect();
  const simulationRect = simulation.getBoundingClientRect();

  // Set starting position (from receiver's left edge)
  const startX = receiverRect.left - simulationRect.left - ackEl.offsetWidth;
  const startY =
    receiverRect.top + receiverRect.height / 2 - simulationRect.top;

  // Set ending position (at sender's right edge)
  const endX = senderRect.right - simulationRect.left;
  const endY = senderRect.top + senderRect.height / 2 - simulationRect.top;

  // Calculate middle point for ACK loss visualization
  const midX = startX + (endX - startX) / 2;
  const midY = startY + (endY - startY) / 2;

  // Set initial position
  ackEl.style.left = `${startX}px`;
  ackEl.style.top = `${startY}px`;

  // Adjust animation speed based on user setting
  const duration = 1500 / config.speed;
  const lostDuration = 800 / config.speed;

  if (isLost) {
    // Animate the ACK to the middle then disappear
    setTimeout(() => {
      ackEl.style.transition = `left ${lostDuration}ms ease-in-out, top ${lostDuration}ms ease-in-out`;
      ackEl.style.left = `${midX}px`;
      ackEl.style.top = `${midY}px`;

      setTimeout(() => {
        ackEl.classList.add("lost");

        setTimeout(() => {
          ackEl.remove();
        }, 1000);
      }, lostDuration);
    }, 50);
  } else {
    // Animate the ACK from receiver to sender
    setTimeout(() => {
      ackEl.style.transition = `left ${duration}ms ease-in-out, top ${duration}ms ease-in-out`;
      ackEl.style.left = `${endX}px`;
      ackEl.style.top = `${endY}px`;

      setTimeout(() => {
        ackEl.remove();
      }, duration + 100);
    }, 50);
  }
}

// Check if packet should be lost based on loss rate
function shouldLosePacket() {
  return Math.random() * 100 < config.packetLossRate;
}

// Check if ACK should be lost based on loss rate
function shouldLoseAck() {
  return Math.random() * 100 < config.ackLossRate;
}

// Send a packet
function sendPacket(seqNum) {
  if (!state.simRunning || state.isPaused) return;

  // Check if packet is within sender window
  if (
    seqNum < state.base ||
    seqNum >= state.base + config.windowSize ||
    seqNum >= config.totalPackets
  ) {
    return;
  }

  // Update sender buffer status
  state.senderBuffer[seqNum].status = "sent";
  state.senderBuffer[seqNum].element.classList.add("sent");

  // Track the packet in flight
  state.inFlight.push(seqNum);

  // Update stats
  stats.packetsSent++;
  updateStatsDisplay();

  logEvent("Packet", `Sending packet ${seqNum}`);

  // Determine if packet will be lost
  const isLost = shouldLosePacket();

  // Animate packet transmission
  animatePacketTransmission(seqNum, isLost);

  if (isLost) {
    // Handle packet loss
    setTimeout(() => {
      logEvent("Packet", `Packet ${seqNum} was lost`);
      stats.packetsLost++;
      updateStatsDisplay();

      // Packet is lost, so it needs to be retransmitted after timeout
      state.senderBuffer[seqNum].status = "timeout";
      state.senderBuffer[seqNum].element.classList.remove("sent");
      state.senderBuffer[seqNum].element.classList.add("timeout");
    }, 1000 / config.speed);
  } else {
    // Packet successfully arrives at receiver
    setTimeout(() => {
      receivePacket(seqNum);
    }, 1700 / config.speed); // Slightly longer than animation time
  }

  // Set timeout for this packet
  startTimeout(seqNum);
}

// Receive a packet at the receiver side
function receivePacket(seqNum) {
  if (!state.simRunning || state.isPaused) return;

  // Update receiver buffer
  if (
    seqNum >= state.expectedSeqNum &&
    seqNum < state.expectedSeqNum + config.windowSize
  ) {
    state.receiverBuffer[seqNum].status = "received";
    state.receiverBuffer[seqNum].element.classList.add("received");

    logEvent("Packet", `Packet ${seqNum} received successfully`);
    stats.packetsReceived++;
    updateStatsDisplay();

    // Send ACK for this packet
    sendAck(seqNum);

    // If this is the expected sequence number, advance the window
    if (seqNum === state.expectedSeqNum) {
      // Find the next expected sequence number (the first unreceived packet)
      let i = state.expectedSeqNum + 1;
      while (
        i < config.totalPackets &&
        state.receiverBuffer[i].status === "received"
      ) {
        i++;
      }

      if (i > state.expectedSeqNum) {
        logEvent(
          "Window",
          `Receiver window slides from ${state.expectedSeqNum} to ${i}`
        );
        state.expectedSeqNum = i;
        updateWindow();
      }
    }
  } else {
    // Packet outside window, still send ACK but don't update buffer
    logEvent(
      "Packet",
      `Packet ${seqNum} received (duplicate or outside window)`
    );
    sendAck(seqNum);
  }
}

// Send an ACK
function sendAck(seqNum) {
  if (!state.simRunning || state.isPaused) return;

  stats.acksSent++;
  updateStatsDisplay();

  logEvent("ACK", `Sending ACK ${seqNum}`);

  // Determine if ACK will be lost
  const isLost = shouldLoseAck();

  // Animate ACK transmission
  animateAckTransmission(seqNum, isLost);

  if (isLost) {
    // Handle ACK loss
    setTimeout(() => {
      logEvent("ACK", `ACK ${seqNum} was lost`);
      stats.acksLost++;
      updateStatsDisplay();
    }, 1000 / config.speed);
  } else {
    // ACK successfully arrives at sender
    setTimeout(() => {
      receiveAck(seqNum);
    }, 1700 / config.speed); // Slightly longer than animation time
  }
}

// Receive an ACK at the sender side
function receiveAck(seqNum) {
  if (!state.simRunning || state.isPaused) return;

  logEvent("ACK", `ACK ${seqNum} received`);

  // Update sender buffer status
  if (seqNum >= state.base && seqNum < state.base + config.windowSize) {
    state.senderBuffer[seqNum].status = "acked";
    state.senderBuffer[seqNum].element.classList.remove("sent", "timeout");
    state.senderBuffer[seqNum].element.classList.add("acked");

    // Remove from in-flight list
    const index = state.inFlight.indexOf(seqNum);
    if (index > -1) {
      state.inFlight.splice(index, 1);
    }

    // Cancel timeout for this packet
    clearTimeout(state.timeoutEvents[seqNum]);
    delete state.timeoutEvents[seqNum];

    // If this is the base, advance the window
    if (seqNum === state.base) {
      // Find the new base (the first unacknowledged packet)
      let i = state.base + 1;
      while (
        i < config.totalPackets &&
        state.senderBuffer[i].status === "acked"
      ) {
        i++;
      }

      if (i > state.base) {
        logEvent("Window", `Sender window slides from ${state.base} to ${i}`);
        state.base = i;
        updateWindow();

        // Send new packets if possible
        setTimeout(sendNextPackets, 500 / config.speed);
      }
    }
  }
}

// Start a timeout for a packet
function startTimeout(seqNum) {
  // Cancel any existing timeout for this sequence number
  if (state.timeoutEvents[seqNum]) {
    clearTimeout(state.timeoutEvents[seqNum]);
  }

  // Set new timeout
  state.timeoutEvents[seqNum] = setTimeout(() => {
    if (!state.simRunning || state.isPaused) return;

    // Only retransmit if not already acknowledged
    if (state.senderBuffer[seqNum].status !== "acked") {
      logEvent("Timeout", `Timeout for packet ${seqNum}, retransmitting`);
      stats.timeouts++;
      updateStatsDisplay();

      // Update visual status
      state.senderBuffer[seqNum].status = "timeout";
      state.senderBuffer[seqNum].element.classList.remove("sent");
      state.senderBuffer[seqNum].element.classList.add("timeout");

      // Small delay before retransmitting
      setTimeout(() => {
        state.senderBuffer[seqNum].status = "unsent";
        state.senderBuffer[seqNum].element.classList.remove("timeout");
        sendPacket(seqNum);
      }, 500 / config.speed);
    }
  }, config.timeout / config.speed);
}

// Send next packets in the window
function sendNextPackets() {
  if (!state.simRunning || state.isPaused) return;

  const windowEnd = Math.min(
    state.base + config.windowSize,
    config.totalPackets
  );

  // Check if all packets are sent
  if (state.nextSeqNum >= config.totalPackets) {
    checkSimulationComplete();
    return;
  }

  // Send packets within the window that aren't already sent or acked
  if (state.nextSeqNum < windowEnd) {
    const seqNum = state.nextSeqNum;
    state.nextSeqNum++;

    if (state.senderBuffer[seqNum].status === "unsent") {
      sendPacket(seqNum);

      // Schedule next packet with slight delay
      setTimeout(sendNextPackets, 300 / config.speed);
    } else {
      // Current packet already sent, move to next
      sendNextPackets();
    }
  } else {
    // Window is full, wait for ACKs
    checkSimulationComplete();
  }
}

// Check if simulation is complete
function checkSimulationComplete() {
  // Simulation is complete when all packets are acknowledged
  let complete = true;
  for (let i = 0; i < config.totalPackets; i++) {
    if (state.senderBuffer[i].status !== "acked") {
      complete = false;
      break;
    }
  }

  if (complete && state.simRunning) {
    state.simRunning = false;
    logEvent(
      "System",
      "Simulation complete! All packets successfully transmitted."
    );
    startBtn.textContent = "Start Simulation";
    startBtn.disabled = false;
    pauseBtn.disabled = true;
  }
}

// Start the simulation
function startSimulation() {
  if (!state.simRunning) {
    // First time starting
    state.simRunning = true;
    state.isPaused = false;
    startBtn.textContent = "Restart";
    pauseBtn.disabled = false;

    // Disable configuration inputs
    windowSizeInput.disabled = true;
    packetLossInput.disabled = true;
    ackLossInput.disabled = true;
    timeoutInput.disabled = true;

    logEvent("System", "Simulation started");

    // Start sending packets
    sendNextPackets();
  } else if (state.isPaused) {
    // Resuming from pause
    state.isPaused = false;
    pauseBtn.textContent = "Pause";
    logEvent("System", "Simulation resumed");

    // Resume sending packets
    sendNextPackets();
  } else {
    // Restart
    resetSimulation();
    setTimeout(startSimulation, 100);
  }
}

// Pause the simulation
function pauseSimulation() {
  if (state.simRunning && !state.isPaused) {
    state.isPaused = true;
    pauseBtn.textContent = "Resume";
    logEvent("System", "Simulation paused");
  } else if (state.isPaused) {
    state.isPaused = false;
    pauseBtn.textContent = "Pause";
    logEvent("System", "Simulation resumed");

    // Resume sending packets
    sendNextPackets();
  }
}

// Reset the simulation
function resetSimulation() {
  // Clear all timeouts
  for (let seqNum in state.timeoutEvents) {
    clearTimeout(state.timeoutEvents[seqNum]);
  }

  // Clear all animations
  simulation.querySelectorAll(".packet").forEach((el) => el.remove());

  // Reset UI elements
  startBtn.textContent = "Start Simulation";
  pauseBtn.textContent = "Pause";
  pauseBtn.disabled = true;

  // Re-enable configuration inputs
  windowSizeInput.disabled = false;
  packetLossInput.disabled = false;
  ackLossInput.disabled = false;
  timeoutInput.disabled = false;

  logEvent("System", "Simulation reset");

  // Reinitialize
  initialize();
}

// Update simulation speed
function updateSpeed() {
  config.speed = parseFloat(speedSlider.value);
  speedValue.textContent = config.speed + "x";
}

// Event listeners
startBtn.addEventListener("click", startSimulation);
pauseBtn.addEventListener("click", pauseSimulation);
resetBtn.addEventListener("click", resetSimulation);
speedSlider.addEventListener("input", updateSpeed);

// Initialize on page load
window.addEventListener("load", initialize);
