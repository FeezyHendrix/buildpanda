import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

// Production runtime 0.1.1 includes Enriched. Expo Go cannot load custom views.
export const enrichedAvailable = Platform.OS === "web" || Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
