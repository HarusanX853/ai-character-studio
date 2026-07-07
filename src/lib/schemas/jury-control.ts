import { z } from "zod";

export const hostMessageSchema = z.object({
  kind: z.enum(["task", "evidence", "message"]).default("message"),
  content: z.string().trim().min(1)
});

export type HostMessageInput = z.infer<typeof hostMessageSchema>;

export const independentOpinionOutputSchema = z.object({
  verdict: z.enum(["guilty", "not_guilty", "undecided"]),
  guilty_probability: z.number().min(0).max(100),
  key_evidence: z.string().min(1),
  most_influential_juror_argument: z.string().min(1),
  rationale: z.string().min(1),
  speech: z.string().min(1)
});

export type IndependentOpinionOutput = z.infer<typeof independentOpinionOutputSchema>;

export const fallbackIndependentOpinionOutput: IndependentOpinionOutput = {
  verdict: "undecided",
  guilty_probability: 50,
  key_evidence: "现有证据还不足以形成稳定判断。",
  most_influential_juror_argument: "暂无明确影响最大的公开论点。",
  rationale: "需要主持人释放更多证据或任务约束后再收敛判断。",
  speech: "我目前无法给出强结论，倾向保持 50% 的暂定判断；下一步最需要核对证据链是否能直接连接被告与关键行为。"
};
