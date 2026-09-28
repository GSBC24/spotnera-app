export const FEEDBACK_QUESTIONS = [
  { id: "q1", label: "What do you think Spotnera does?", type: "text" },
  { id: "q2", label: "How easy was it to create your business?", type: "choice",
    options: ["Very easy", "Easy", "Difficult", "Very difficult"] },
  { id: "q3", label: "How easy was it to create a Deal?", type: "choice",
    options: ["Very easy", "Easy", "Difficult", "Very difficult"] },
  { id: "q4", label: "Was anything confusing?", type: "text" },
  { id: "q5", label: "Could you understand when your Deal would be visible or available?",
    type: "choice", options: ["Yes", "No", "Not sure"] },
  { id: "q6", label: "Could you easily find your business, Deals, Analytics, and Reviews?",
    type: "choice", options: ["Yes", "No", "Partly"] },
  { id: "q7", label: "What was the most useful part of Spotnera for your business?", type: "text" },
  { id: "q8", label: "Is there anything you expected Spotnera to do that you could not find?", type: "text" },
  { id: "q9", label: "Would you use Spotnera again to publish an offer?",
    type: "choice", options: ["Yes", "Maybe", "No"] },
  { id: "q10", label: "What is the ONE thing you would improve first?", type: "text" },
];

export async function submitFeedback(payload, fetchImpl = fetch) {
  try {
    const response = await fetchImpl("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok && (await response.json())?.sent === true;
  } catch {
    return false;
  }
}
