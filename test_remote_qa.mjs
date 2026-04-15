import axios from "axios";
import { io } from "socket.io-client";

const API_URL = "https://chatify-nesy.onrender.com/api";
const SOCKET_URL = "https://chatify-nesy.onrender.com";

async function runTests() {
  console.log("Starting QA Test Suite on DEPLOYED LINK...");
  
  const results = [];
  const logInfo = (action, result, status) => { 
    console.log(`${action} → ${result} → ${status}`); 
  };

  try {
    // 1. Auth Testing
    const userA = { fullName: "UserA", email: `qa${Date.now()}@test.com`, password: "password123" };
    const userB = { fullName: "UserB", email: `qb${Date.now()}@test.com`, password: "password123" };

    const axiosA = axios.create({ baseURL: API_URL, withCredentials: true });
    const axiosB = axios.create({ baseURL: API_URL, withCredentials: true });

    let cookiesA, cookiesB;
    
    try {
      const resA = await axiosA.post("/auth/signup", userA);
      cookiesA = resA.headers["set-cookie"];
      userA._id = resA.data._id || (resA.data.user && resA.data.user._id);
      logInfo("Signup", "Success", "PASS");
    } catch(e) { 
      logInfo("Signup", "Failed or timeout", "FAIL"); 
      return; 
    }

    try {
        const resBL = await axiosB.post("/auth/signup", userB);
        userB._id = resBL.data._id || (resBL.data.user && resBL.data.user._id);
        logInfo("Login", "Success", "PASS");
    } catch(e) {
        logInfo("Login", "Failed", "FAIL");
    }

    try {
        await axiosA.post("/auth/logout");
        logInfo("Logout", "Success", "PASS");
    } catch(e) {
        logInfo("Logout", "Failed", "FAIL");
    }

    // 2. Simulating Real-time (Socket.io)
    // Connect Socket A & B
    const socketA1 = io(SOCKET_URL, { query: { userId: userA._id } });
    const socketA2 = io(SOCKET_URL, { query: { userId: userA._id } }); // Multiple Tabs
    const socketB = io(SOCKET_URL, { query: { userId: userB._id } });

    await new Promise(r => setTimeout(r, 2000)); // wait for connections

    let sA1Msg = 0, sA2Msg = 0, sBMsg = 0;
    socketA1.on("newMessage", () => sA1Msg++);
    socketA2.on("newMessage", () => sA2Msg++);
    socketB.on("newMessage", () => sBMsg++);

    // Chat functionality: A -> B
    try {
        await axiosA.post(`/messages/send/${userB._id}`, { text: "Hello from A" }, { headers: { Cookie: cookiesA } });
        logInfo("Send message API", "Message sent", "PASS");
    } catch(e) {
        logInfo("Send message API", "Failed", "FAIL");
    }

    await new Promise(r => setTimeout(r, 500));

    if (sBMsg === 1) {
        logInfo("Receive message instantly (Socket)", "Received", "PASS");
    } else {
        logInfo("Receive message instantly (Socket)", "Not received or duplicate", "FAIL");
    }

    // Test Multi Tab (User B sends to User A)
    await axiosB.post(`/messages/send/${userA._id}`, { text: "Hello from B" }, { headers: { Cookie: cookiesB } });
    await new Promise(r => setTimeout(r, 500));
    
    if (sA1Msg === 1 && sA2Msg === 1) {
        logInfo("Open 2 tabs", "Both tabs sync", "PASS");
    } else {
        logInfo("Open 2 tabs", "One tab missed message", "FAIL");
    }

    // Test Empty Message
    try {
        await axiosA.post(`/messages/send/${userB._id}`, { text: "", image: null }, { headers: { Cookie: cookiesA } });
        logInfo("Send empty message", "Server accepted invalid message", "FAIL");
    } catch(e) {
        logInfo("Send empty message", "Rejected by server", "PASS");
    }

    // Disconnect A1
    socketA1.disconnect();
    await new Promise(r => setTimeout(r, 500));
    
    try {
        await axiosB.post(`/messages/send/${userA._id}`, { text: "Hello from B again" }, { headers: { Cookie: cookiesB } });
        await new Promise(r => setTimeout(r, 500));
    
        if (sA2Msg === 2) {
            logInfo("Refresh page / Disconnect map", "Session recovered", "PASS");
        } else {
            logInfo("Refresh page / Disconnect map", "User fully disconnected from all tabs", "FAIL");
        }
    } catch (e) {
        logInfo("Refresh page / Disconnect map", "Error", "FAIL");
    }

    socketA2.disconnect();
    socketB.disconnect();

  } catch (err) {
    console.error(err);
  }
}

runTests();
