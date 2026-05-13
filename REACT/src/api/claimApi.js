import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

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
