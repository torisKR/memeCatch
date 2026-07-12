import { createProductRedirectHandler } from "@/lib/affiliate/product-redirect";
import {
  getActiveAffiliateRedirect,
  recordAffiliateProductClick,
} from "@/lib/affiliate/repository.server";

export const GET = createProductRedirectHandler(
  {
    getActiveRedirect: getActiveAffiliateRedirect,
    recordClick: recordAffiliateProductClick,
  },
  () => new Date(),
);
