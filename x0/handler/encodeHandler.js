const customDetectors = require("./encodeDetection");

function detectEncoding(value) {
  const detectedEncodings = {};

  const customResults = {
    NullByte: customDetectors.detectNullByte(value),
    URLEncoding: customDetectors.detectURLEncoding(value),
    HexadecimalEncoding: customDetectors.detectHexadecimalEncoding(value),
    DoubleURLEncoding: customDetectors.detectDoubleURLEncoding(value),
    HtmlEntityEncoding: customDetectors.detectHtmlEntityEncoding(value),
    Base64EncodingGet: customDetectors.detectBase64EncodingGet(value),
    Base64EncodePost: customDetectors.detectBase64EncodingPost(value),
    Space: customDetectors.detectSpacedTagEncoding(value),
    StringManipulate: customDetectors.detectStringManipulation(value),
    UnicodeEncoding: customDetectors.detectUnicodeEncoding(value),
    OctalEncoding: customDetectors.detectOctalEncoding(value),
    Obs: customDetectors.detectObfuscation(value),
    Compression: customDetectors.detectCompression(value),
    MorseCode: customDetectors.detectMorseCode(value),
    JavaScriptObfuscation: customDetectors.detectJavaScriptObfuscation(value),
    CharEncode: customDetectors.detectCharEncode(value),
    BinaryEncode: customDetectors.detectBinary(value),
    Between: customDetectors.detectBetween(value),
    CharUnicodeEncode: customDetectors.detectCharUnicodeEncode(value),
    CharUnicodeEscape: customDetectors.detectCharUnicodeEscape(value),
    DecimalEntities: customDetectors.detectDecimalEntities(value),
    Dunion: customDetectors.detectDunion(value),
    EqualToLike: customDetectors.detectEqualToLike(value),
    EqualToOrLike: customDetectors.detectEqualToRlike(value),
    Greatest: customDetectors.detectGreatest(value),
    Hex2Char: customDetectors.detectHex2Char(value),
    HexEntities: customDetectors.detectHexEntities(value),
    If2Case: customDetectors.detectIf2Case(value),
    IfNull2Case: customDetectors.detectIfnull2CaseWhenIsnull(value),
    IfNull2: customDetectors.detectIfnull2IfIsnull(value),
    InformationSchema: customDetectors.detectInformationSchemaComment(value),
    Least: customDetectors.detectLeast(value),
    UpperCase: customDetectors.detectUppercase(value),
    LuNginx: customDetectors.detectLuaNginx(value),
    JsonBreakingPayload: customDetectors.detectJsonBreakingPayload(value),
  };

  for (const [type, result] of Object.entries(customResults)) {
    if (result && Object.values(result).some((value) => value)) {
      detectedEncodings[type] = result;
      break;
    }
  }

  if (Object.keys(detectedEncodings).length === 0) {
    detectedEncodings.clean = true;
  }

  return detectedEncodings;
}

function analyzeRequestBody(body) {
  const encodingResults = {};

  Object.entries(body).forEach(([key, value]) => {
    encodingResults[key] = detectEncoding(value.toString());
  });

  return encodingResults;
}

module.exports = { detectEncoding, analyzeRequestBody };
