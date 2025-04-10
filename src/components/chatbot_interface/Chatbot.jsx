import React, { useState, useEffect, useRef } from "react";

const ChatBot = () => {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [socket, setSocket] = useState(null);
  const chatEndRef = useRef(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [showInitialOptions, setShowInitialOptions] = useState(true);

  useEffect(() => {
    let ws;
    const connectWebSocket = () => {
      ws = new WebSocket("ws://localhost:8000/ws");

      ws.onopen = () => {
        console.log("WebSocket Connected");
        setSocket(ws);
        // Add welcome message when socket connects
        setMessages([
          {
            sender: "bot",
            text: "How can I help you today?",
            isWelcome: true,
          },
        ]);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("RECEIVED DATA", data);

        // Handle "Results retrieved" message
        if (data.messeage === "Results retrieved") {
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: "Results retrieved successfully." },
          ]);
        }

        // Handle similar issues - show all issues in the array
        if (data.similar_issues && data.similar_issues.length > 0) {
          // Create messages for each similar issue
          const issueMessages = data.similar_issues.map((issue) => {
            return {
              sender: "bot",
              text: `🔍 Similar Issue Found:
🔹 Issue Key: ${issue.key}
🔹 Summary: ${issue.summary || "N/A"}
🔹 Status: ${issue.status || "Unknown"}
🛠 Solution: ${issue.solution || "Not provided"}`,
            };
          });

          // Add all issue messages to the chat
          setMessages((prev) => {
            // Only add messages that don't already exist
            const existingTexts = prev.map((msg) => msg.text);
            const newMessages = issueMessages.filter(
              (msg) => !existingTexts.includes(msg.text)
            );

            return [...prev, ...newMessages];
          });
        } else if (data.similar_issues && data.similar_issues.length === 0) {
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: "❌ No similar issues found." },
          ]);
        }

        // Article display logic
        if (data.articles) {
          const { title, excerpt, view_link } = data.articles;

          // Process excerpt to clean up Unicode escape sequences
          const cleanExcerpt = excerpt
            ? excerpt.replace(/\\uD83[0-9A-F]{2}\\uD[0-9A-F]{3}/g, "")
            : "";

          const bulletPoints = cleanExcerpt
            .split("\n")
            .filter((line) => line.trim() !== "")
            .map((line, i) => `${i + 1}) ${line}`)
            .join("\n");

          const articleMessage = `📘 Knowledge Article:
🔹 Title: ${title || "N/A"}
🔹 Points:
${bulletPoints || "No details available"}
🔹 Read more: ${view_link || "#"}`;

          setMessages((prev) => {
            const exists = prev.some((msg) => msg.text === articleMessage);
            if (exists) return prev;
            return [...prev, { sender: "bot", text: articleMessage }];
          });
        }

        // Status message
        if (data.status) {
          const cleanStatus = data.status.replace(
            /\\uD83[0-9A-F]{2}\\uD[0-9A-F]{3}/g,
            ""
          );

          // If ticket_details exist, format and append the message
          if (data.ticket_details) {
            const { ticket_id, ticket_Key } = data.ticket_details;
            const ticketMessage = `🎫 ${cleanStatus}\n🔹 Ticket Key: ${ticket_Key}\n🔹 Ticket ID: ${ticket_id}`;

            setMessages((prev) => [
              ...prev,
              { sender: "bot", text: ticketMessage },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              { sender: "bot", text: cleanStatus },
            ]);
          }
        }

        // Handle generic message that doesn't match other conditions
        if (
          data.messeage &&
          data.messeage !== "Results retrieved" &&
          !data.status &&
          !data.articles &&
          (!data.similar_issues || data.similar_issues.length === 0)
        ) {
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: data.messeage },
          ]);
        }
      };

      ws.onerror = (err) => console.error("WebSocket error:", err);
      ws.onclose = () => console.log("WebSocket closed");
    };

    connectWebSocket();
    return () => ws?.close();
  }, []);

  // Function to clean up Unicode escape sequences
  const cleanUnicodeSequences = (text) => {
    if (!text) return "";
    return text.replace(/\\uD83[0-9A-F]{2}\\uD[0-9A-F]{3}/g, "");
  };

  const sendMessage = (text = userInput) => {
    if (socket && text.trim() !== "") {
      setUserInteracted(true);
      setShowInitialOptions(false);
      socket.send(text);
      setMessages((prev) => [...prev, { sender: "user", text: text }]);
      setUserInput("");
    }
  };

  const handleOptionClick = (option) => {
    sendMessage(option);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div style={styles.background}>
      <div style={styles.container}>
        <h2 style={styles.heading}>IT Ops ChatBot</h2>
        <div style={styles.chatBox}>
          {messages.map((msg, idx) => {
            // Clean any Unicode escape sequences from message text
            const cleanText = cleanUnicodeSequences(msg.text);

            return (
              <div
                key={idx}
                style={{
                  ...styles.message,
                  alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                  backgroundColor:
                    msg.sender === "user"
                      ? "rgba(220, 248, 198, 0.75)"
                      : "rgba(240, 240, 240, 0.65)",
                  borderColor:
                    msg.sender === "user"
                      ? "rgba(190, 230, 160, 0.5)"
                      : "rgba(200, 200, 200, 0.5)",
                }}
              >
                {cleanText.split("\n").map((line, i) => (
                  <div key={i} style={styles.messageLine}>
                    {line}
                  </div>
                ))}

                {/* Show options below welcome message */}
                {msg.isWelcome && showInitialOptions && (
                  <div style={styles.optionsContainer}>
                    {[
                      "Issue related",
                      "Update ticket",
                      "Close ticket",
                      "Ticket status",
                    ].map((option, i) => (
                      <button
                        key={i}
                        style={styles.optionButton}
                        onClick={() => handleOptionClick(option)}
                      >
                        {i + 1}) {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>
        <div style={styles.inputArea}>
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            style={styles.input}
            placeholder="Type your message..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button onClick={() => sendMessage()} style={styles.sendBtn}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  background: {
    width: "89%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  container: {
    width: "100%",
    background: "linear-gradient(135deg, #6e8efb, #a777e3)",
    maxWidth: "600px",
    padding: "25px",
    borderRadius: "16px",
    backdropFilter: "blur(10px)",
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    boxShadow: "0 8px 32px rgba(31, 38, 135, 0.2)",
    border: "1px solid rgba(255, 255, 255, 0.18)",
    color: "#333",
  },
  heading: {
    textAlign: "center",
    marginBottom: "20px",
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: "24px",
    fontWeight: "600",
    textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  chatBox: {
    height: "400px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "15px",
    borderRadius: "12px",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    boxShadow: "inset 0 2px 10px rgba(0, 0, 0, 0.05)",
  },
  message: {
    maxWidth: "75%",
    padding: "12px 16px",
    borderRadius: "14px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowWrap: "break-word",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    backdropFilter: "blur(5px)",
    fontSize: "14px",
    lineHeight: "1.5",
  },
  messageLine: {
    maxWidth: "100%",
    overflowWrap: "break-word",
  },
  optionsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "12px",
    width: "100%",
  },
  optionButton: {
    padding: "10px 12px",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    borderRadius: "10px",
    cursor: "pointer",
    textAlign: "left",
    fontSize: "14px",
    fontWeight: "500",
    color: "#333",
    transition: "all 0.2s ease",
    backdropFilter: "blur(5px)",
    boxShadow: "0 2px 5px rgba(0, 0, 0, 0.05)",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.7)",
      boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
    },
  },
  inputArea: {
    marginTop: "15px",
    display: "flex",
    gap: "10px",
  },
  input: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    fontSize: "15px",
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    backdropFilter: "blur(5px)",
    color: "#333",
    outline: "none",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
    transition: "all 0.3s ease",
  },
  sendBtn: {
    padding: "12px 20px",
    backgroundColor: "rgba(0, 168, 132, 0.85)",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "600",
    backdropFilter: "blur(5px)",
    boxShadow: "0 4px 10px rgba(0, 168, 132, 0.3)",
    transition: "all 0.3s ease",
  },
};

export default ChatBot;
