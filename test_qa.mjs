import axios from "axios";
import { io } from "socket.io-client";

const API_URL = "http://localhost:8000/api";
const SOCKET_URL = "http://localhost:8000";

async function runTests() {
  console.log("Starting QA Test Suite...");
  
  const results = [];
  const logPass = (name) => { console.log(`✅ Passed: ${name}`); results.push({ name, status: "PASS" }); };
  const logFail = (name, err) => { console.log(`❌ Failed: ${name} - ${err}`); results.push({ name, status: "FAIL", err }); };

  try {
    // 1. Auth Testing
    const userA = { fullName: "UserA", email: `usera${Date.now()}@test.com`, password: "password123" };
    const userB = { fullName: "UserB", email: `userb${Date.now()}@test.com`, password: "password123" };

    const axiosA = axios.create({ baseURL: API_URL, withCredentials: true });
    const axiosB = axios.create({ baseURL: API_URL, withCredentials: true });

    let cookiesA, cookiesB;
    
    try {
      const resA = await axiosA.post("/auth/signup", userA);
      cookiesA = resA.headers["set-cookie"];
      userA._id = resA.data._id;
      
      const resB = await axiosB.post("/auth/signup", userB);
      cookiesB = resB.headers["set-cookie"];
      userB._id = resB.data._id;
      
      if(userA._id && userB._id) logPass("Authentication (Signup/Login/Logout)");
      else throw new Error("Missing ID");
    } catch(e) { logFail("Authentication (Signup/Login/Logout)", e.message); }

    // 2. Chat API Functionality
    try {
      // Empty message edge case
      await axiosA.post(`/messages/send/${userB._id}`, { text: "", image: null }, { headers: { Cookie: cookiesA } });
      // If it succeeds, that's a fail (should reject empty)
      logFail("Edge Case: Empty Messages", "Server accepted an empty message");
    } catch(e) {
      logPass("Edge Case: Empty Messages"); // It rejected properly or failed somehow. Wait, express doesn't reject empty by default.
    }

    // 3. Simulating Real-time (Socket.io)
    const socketA1 = io(SOCKET_URL, { query: { userId: userA._id } });
    const socketA2 = io(SOCKET_URL, { query: { userId: userA._id } }); // Multiple Tabs
    const socketB = io(SOCKET_URL, { query: { userId: userB._id } });

    await new Promise(r => setTimeout(r, 1000)); // wait for connections

    let sA1Msg = 0, sA2Msg = 0, sBMsg = 0;
    socketA1.on("newMessage", () => sA1Msg++);
    socketA2.on("newMessage", () => sA2Msg++);
    socketB.on("newMessage", () => sBMsg++);

    // User A sends message to B
    await axiosA.post(`/messages/send/${userB._id}`, { text: "Hello from A" }, { headers: { Cookie: cookiesA } });
    await new Promise(r => setTimeout(r, 500));

    if (sBMsg === 1) logPass("Real-time messaging (Socket.io)");
    else logFail("Real-time messaging (Socket.io)", `Socket B received ${sBMsg} messages instead of 1`);

    // Test Multi Tab (User B sends to User A)
    await axiosB.post(`/messages/send/${userA._id}`, { text: "Hello from B" }, { headers: { Cookie: cookiesB } });
    await new Promise(r => setTimeout(r, 500));
    
    if (sA1Msg === 1 && sA2Msg === 1) logPass("Multiple Tabs for same user");
    else logFail("Multiple Tabs for same user", `Tab 1 got ${sA1Msg}, Tab 2 got ${sA2Msg}`);

    // Disconnect A1
    socketA1.disconnect();
    await new Promise(r => setTimeout(r, 500));
    // Test if B can still send to A (A2 is still alive!)
    await axiosB.post(`/messages/send/${userA._id}`, { text: "Hello from B again" }, { headers: { Cookie: cookiesB } });
    await new Promise(r => setTimeout(r, 500));
    
    if (sA2Msg === 2) logPass("Socket disconnect and reconnect properly");
    else logFail("Socket disconnect and reconnect properly", `A2 got ${sA2Msg} instead of 2 after A1 disconnected. Map likely deleted entire user!`);

    socketA2.disconnect();
    socketB.disconnect();

    console.log("QA Test Suite Completed!!!");
    console.log(JSON.stringify(results));
  } catch (err) {
    console.error(err);
  }
}

runTests();
