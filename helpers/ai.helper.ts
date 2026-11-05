export const aiGenerateAnswer = async (prompt: string) => {
  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });
  } catch (error) {
    console.error("Không kết nối được tới Groq:", error);
    throw new Error("Lỗi kết nối đến dịch vụ AI. Vui lòng kiểm tra lại kết nối mạng!");
  }

  const data: any = await response.json();

  if (!response.ok || !data.choices || !data.choices.length) {
    console.error("Lỗi từ Groq API:", data);
    throw new Error(data.error?.message || "Không thể lấy phản hồi từ AI lúc này!");
  }

  const content = data.choices[0]?.message?.content || "";

  return content;
}
