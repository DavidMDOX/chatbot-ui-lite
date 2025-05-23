import { useState } from "react";
import { agents } from "@/utils/agents";
import { Message } from "@/types";

type AgentRole = keyof typeof agents;
type RoleName = AgentRole | "user";

const subAgents: AgentRole[] = [
  "infoExtractor",
  "fraudAuditor",
  "priceQuoter",
  "logisticsCoordinator",
  "afterSalesSupport",
];

export default function MultiAgentChat() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [chatByRole, setChatByRole] = useState<Record<AgentRole, string>>({
    controller: "",
    infoExtractor: "",
    fraudAuditor: "",
    priceQuoter: "",
    logisticsCoordinator: "",
    afterSalesSupport: "",
  });

  const updateChat = (role: AgentRole, value: string) => {
    setChatByRole((prev) => ({ ...prev, [role]: value }));
  };

  const handleSendToController = async () => {
    if (!input.trim()) return;
    setLoading(true);

    const userMessage: Message = { role: "user", content: input };

    await fetchAgentResponse([userMessage], "controller", (text) =>
      updateChat("controller", text)
    );

    await Promise.all(
      subAgents.map((role) =>
        fetchAgentResponse([userMessage], role, (text) =>
          updateChat(role, text)
        )
      )
    );

    setInput("");
    setLoading(false);
  };

  const fetchAgentResponse = async (
    messages: Message[],
    agentType: AgentRole,
    onDelta: (text: string) => void
  ): Promise<void> => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, agentType }),
      });

      if (!res.ok || !res.body) {
        onDelta("（助手未能回应，请稍后再试）");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let result = "";
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk
            .split("\n")
            .filter((line) => line.trim().startsWith("data:"));
          for (const line of lines) {
            const jsonStr = line.replace("data: ", "").trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const json = JSON.parse(jsonStr);
              const delta =
                json.choices?.[0]?.delta?.content ??
                json.choices?.[0]?.message?.content;
              if (delta) {
                result += delta;
                onDelta(result);
              }
            } catch (err) {
              console.error("JSON parse error:", err);
            }
          }
        }
      }

      if (!result) onDelta("（助手没有返回任何内容）");
    } catch (err) {
      console.error("fetchAgentResponse error:", err);
      onDelta("（请求出错，请稍后重试）");
    }
  };

  const renderAgentBox = (role: AgentRole) => (
    <div
      key={role}
      className="rounded-xl border border-blue-200 bg-white shadow hover:shadow-md transition-shadow p-5 h-[240px] overflow-y-auto"
    >
      <div className="text-sm font-semibold text-blue-700 mb-2">
        🤖 {agents[role]?.name}
      </div>
      <div className="text-sm text-gray-700 whitespace-pre-wrap">
        {chatByRole[role] || "（暂无消息）"}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 min-h-screen bg-gradient-to-br from-white to-blue-50">
      <h1 className="text-3xl font-bold text-center text-blue-800 mb-1">
        💼 SmartTrade AI (Beta) / 智贸AI团队内测版
      </h1>
      <p className="text-sm text-center text-gray-500 mb-6">
        created by Tastybite Foods
      </p>

      {renderAgentBox("controller")}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6 mb-8">
        {subAgents.map((role) => renderAgentBox(role))}
      </div>

      {loading && (
        <div className="text-sm text-gray-500 mb-4 text-center">
          🤖 助手处理中……
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          className="flex-1 border border-blue-300 px-4 py-2 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="请输入任务，例如：请帮我回复客户的这封英文邮件……"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendToController()}
        />
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow transition-colors"
          disabled={loading}
          onClick={handleSendToController}
        >
          {loading ? "处理中..." : "发送给流程总管"}
        </button>
      </div>
    </div>
  );
}
