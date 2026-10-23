export const STUDY_SUCCESS_EVENT = "pns:study-success";

export function celebrateStudySuccess() {
  window.dispatchEvent(new Event(STUDY_SUCCESS_EVENT));
}