import { ReactSVG } from "react-svg";
import { FormSection } from "@/components/atoms/form-section";
import { icons2 } from "@/assets/icons2/icon2";

export function ComplianceTab() {
  return (
    <div className="flex flex-col gap-6">
      <FormSection 
        title={'Compliance & Data Protection'}
        description={'BuildPanda is committed to keeping your data secure and protected. Dedicated compliance tools are coming soon'}
      >
        <div className='grid grid-cols-2 gap-8 sm:grid-cols-2'>
          <div className='flex flex-col gap-4 border-[0.5px] border-border p-6'>
            <ReactSVG src={icons2.privacy} />
            <p className="text-body-s text-grey-500 font-semibold">Privacy Policy</p>
            <a href="#" target='_blank' rel="noopener noreferrer" className="text-caption-l text-primary font-semibold hover:underline w-4">Read</a>
          </div>
          <div className='flex flex-col gap-4 border-[0.5px] border-border p-6'>
            <ReactSVG src={icons2.agreement} />
            <p className="text-body-s text-grey-500 font-semibold">Data Processing Agreement</p>
            <a href="#" target='_blank' rel="noopener noreferrer" className="text-caption-l text-primary font-semibold hover:underline w-4">Read</a>
          </div>
        </div>
      </FormSection>
    </div>
  );
}
