import { useState } from "react";
import { agents } from "@/utils/agents";
import { Message } from "@/types";

type RoleName = keyof typeof agents | "user";

interface AgentMessage {
  role: RoleName;
  content: string;
}

export default function Home() {
  const [chatLog, setChatLog] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // 发送用户输入到流程主管，并调动其他助手
  const handleSendToController = async () => {
    if (!input.trim()) return;

    const userMessage: AgentMessage = { role: "user", content: input };
    const updatedLog = [...chatLog, userMessage];
    setChatLog(updatedLog);
    setLoading(true);
    setInput("");

    // ✅ 只提取 user 和 assistant 的历史消息，发送给流程主管
    const controllerInput: Message[] = updatedLog
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .map((msg) => ({ role: msg.role as "user" | "assistant", content: msg.content }));

    // 流程主管响应
    const controllerResponse = await fetchAgentResponse(controllerInput, "controller");
    const newLog = [...updatedLog, { role: "controller", content: controllerResponse }];

    // ✅ 给其他专员发送用户原始输入
    const assistantInput: Message[] = [{ role: "user", content: input }];

    const assistantResponses = await Promise.all([
      fetchAgentResponse(assistantInput, "infoExtractor"),
      fetchAgentResponse(assistantInput, "fraudAuditor"),
      fetchAgentResponse(assistantInput, "priceQuoter")
    ]);

    const resultLog = [
      ...newLog,
      { role: "infoExtractor", content: assistantResponses[0] },
      { role: "fraudAuditor", content: assistantResponses[1] },
      { role: "priceQuoter", content: assistantResponses[2] }
    ];

    setChatLog(resultLog);
    setLoading(false);
  };

  // 调用后端接口，获取某个角色助手的回答
  const fetchAgentResponse = async (messages: Message[], agentType: string) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, agentType })
    });

    if (!res.ok || !res.body) return "（助手未能回应，请稍后再试）";

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let result = "";
    let done = false;

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      result += decoder.decode(value);
    }

    return result;
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">SmartTrade 虚拟外贸团队</h1>

      <div className="border rounded-lg bg-white p-4 h-[500px] overflow-y-auto shadow-inner">
        {chatLog.map((msg, i) => (
          <div key={i} className="mb-4">
            <div className="text-sm font-semibold text-gray-600">
              {msg.role === "user"
                ? "🧑 用户"
                : `🤖 ${agents[msg.role as keyof typeof agents]?.name || msg.role}`}
            </div>
            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
          </div>
        ))}
        {loading && <div className="text-sm text-gray-400">助手处理中……</div>}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          className="flex-1 border px-3 py-2 rounded shadow"
          placeholder="请输入任务，例如：请审核客户+回复报价邮件..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendToController()}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded shadow"
          disabled={loading}
          onClick={handleSendToController}
        >
          发送给流程主管
        </button>
      </div>
    </div>
  );
}
