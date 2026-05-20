export const tryParseJSON = (jsonString: string) => {
  try {
    console.log("Attempting to parse JSON string:", jsonString.toString());
    const o = JSON.parse(jsonString);
    if (o && typeof o === "object") {
      return JSON.stringify(o, null, 2);
    }
  } catch (e) {
    console.error(e);
    return jsonString;
  }
  return jsonString;
};
