import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function getFilenameFromDisposition(contentDisposition) {
  if (!contentDisposition) return "";

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match) {
    return decodeURIComponent(utf8Match[1].replace(/"/g, ""));
  }

  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);

  return filenameMatch ? filenameMatch[1] : "";
}

function getFilenameFromHeaders(headers) {
  return (
    headers["x-claim-filename"] ||
    getFilenameFromDisposition(headers["content-disposition"]) ||
    "google-drive-claim.pdf"
  );
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export const uploadClaimFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axios.post(
    `${API_BASE_URL}/api/claims/upload`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
};

export const extractClaimText = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axios.post(
    `${API_BASE_URL}/api/claims/extract-text`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
};

export const listGoogleDriveTestFiles = async () => {
  const response = await axios.get(
    `${API_BASE_URL}/api/claims/google-drive-test-files`
  );

  return response.data;
};

export const importGoogleDriveFile = async ({ fileId, fileUrl }) => {
  let response;

  try {
    response = await axios.post(
      `${API_BASE_URL}/api/claims/import-google-drive`,
      { fileId, fileUrl },
      { responseType: "blob" }
    );
  } catch (error) {
    if (error.response?.data instanceof Blob) {
      const errorText = await error.response.data.text();
      const errorJson = tryParseJson(errorText);

      throw new Error(
        errorJson?.error || errorJson?.message || errorText || "Google Drive import failed.",
        { cause: error }
      );
    }

    throw error;
  }

  const filename = getFilenameFromHeaders(response.headers);
  const fileType = filename.toLowerCase().endsWith(".txt")
    ? "text/plain"
    : "application/pdf";

  return new File([response.data], filename, { type: fileType });
};

export const extractClaimFields = async (rawText) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/claims/extract-fields`,
    {
      rawText,
    }
  );

  return response.data;
};

export const aiExtractClaimFields = async (rawText) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/claims/ai/extract-fields`,
    {
      rawText,
    }
  );

  return response.data;
};

export const validateClaimFields = async (extractedFields) => {
  const response = await axios.post(`${API_BASE_URL}/api/claims/validate`, {
    extractedFields,
  });

  return response.data;
};

export const aiValidateClaimFields = async (extractedFields) => {
  const response = await axios.post(`${API_BASE_URL}/api/claims/ai/validate`, {
    extractedFields,
  });

  return response.data;
};

export const routeClaim = async (extractedFields) => {
  const response = await axios.post(`${API_BASE_URL}/api/claims/route`, {
    extractedFields,
  });

  return response.data;
};

export const aiExplainRoute = async ({
  extractedFields,
  missingFields,
  recommendedRoute,
  reasoning,
}) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/claims/ai/explain-route`,
    {
      extractedFields,
      missingFields,
      recommendedRoute,
      reasoning,
    }
  );

  return response.data;
};

export const checkNvidiaHealth = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/nvidia/health`);
  return response.data;
};
